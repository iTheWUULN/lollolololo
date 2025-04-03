require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const db = require('./database.js'); // SQLite bağlantısı

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

// **Bot Açılınca**
client.once('ready', () => {
    console.log(`✅ Bot ${client.user.tag} olarak çalışıyor!`);
});

// **Slash Komutları**
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const allowedRoleId = process.env.ALLOWED_ROLE_ID;
    if (!interaction.member.roles.cache.has(allowedRoleId)) {
        return interaction.reply({ content: '❌ Bu komutu kullanamazsın!', ephemeral: true });
    }

    // **OYALAMA BAŞLAT**
    if (interaction.commandName === 'oylama-başlat') {
        const kanal = interaction.options.getChannel('kanal');
        if (!kanal) return interaction.reply({ content: 'Lütfen geçerli bir kanal seçin.', ephemeral: true });

        const mesaj = await kanal.send(
            "**OYLAMA BAŞLADI!**\n\nAdaylar aşağıda listelenecektir. Tepkilere basarak oy verebilirsiniz."
        );

        db.run(`INSERT INTO oylamalar (guild_id, message_id, channel_id) VALUES (?, ?, ?)`, 
            [interaction.guild.id, mesaj.id, kanal.id]
        );

        return interaction.reply({ content: `Oylama ${kanal} kanalında başlatıldı.`, ephemeral: true });
    }

    // **OYLAMA ADAY EKLE**
    if (interaction.commandName === 'oylama-aday-ekle') {
        const sunucu = interaction.options.getString('sunucu');
        const tepki = interaction.options.getString('tepki');

        db.get(`SELECT * FROM oylamalar WHERE guild_id = ?`, [interaction.guild.id], async (err, oylama) => {
            if (!oylama) return interaction.reply({ content: 'Önce bir oylama başlatmalısınız!', ephemeral: true });

            const kanal = client.channels.cache.get(oylama.channel_id);
            const mesaj = await kanal.messages.fetch(oylama.message_id);

            db.run(`INSERT INTO adaylar (guild_id, name, emoji) VALUES (?, ?, ?)`, 
                [interaction.guild.id, sunucu, tepki]
            );

            db.all(`SELECT name, emoji FROM adaylar WHERE guild_id = ?`, [interaction.guild.id], async (err, adaylar) => {
                const newMessage = `**OYLAMA BAŞLADI!**\n\nAdaylar:\n\n${adaylar.map(c => `### ${c.name} | ${c.emoji}`).join('\n')}`;
                await mesaj.edit(newMessage);
                await mesaj.react(tepki);
            });

            return interaction.reply({ content: `${sunucu} eklendi.`, ephemeral: true });
        });
    }

    // **OYLAMA BİTİR VE FAKE HESAPLARI BUL**
    if (interaction.commandName === 'oylama-bitir') {
        db.get(`SELECT * FROM oylamalar WHERE guild_id = ?`, [interaction.guild.id], async (err, oylama) => {
            if (!oylama) return interaction.reply({ content: 'Aktif bir oylama bulunamadı.', ephemeral: true });

            const kanal = client.channels.cache.get(oylama.channel_id);
            const mesaj = await kanal.messages.fetch(oylama.message_id);

            const fakeVoters = new Map();
            const newAccounts = [];

            for (const reaction of mesaj.reactions.cache.values()) {
                const users = await reaction.users.fetch();
                users.forEach(user => {
                    if (user.bot) return;

                    if (fakeVoters.has(user.id)) {
                        fakeVoters.set(user.id, fakeVoters.get(user.id) + 1);
                    } else {
                        fakeVoters.set(user.id, 1);
                    }

                    const accountAge = Date.now() - user.createdTimestamp;
                    const ageInDays = accountAge / (1000 * 60 * 60 * 24);
                    if (ageInDays < 7) {
                        newAccounts.push(user);
                    }
                });
            }

            const detectedFakes = [...fakeVoters.entries()].filter(([userId, count]) => count > 1);

            detectedFakes.forEach(([userId, count]) => {
                db.run(`INSERT INTO fake_kullanicilar (guild_id, user_id, reason) VALUES (?, ?, ?)`, 
                    [interaction.guild.id, userId, `Fake oy (Emoji sayısı: ${count})`]
                );
            });

            newAccounts.forEach(user => {
                db.run(`INSERT INTO fake_kullanicilar (guild_id, user_id, reason) VALUES (?, ?, ?)`, 
                    [interaction.guild.id, user.id, `Yeni hesap (Oluşturulma tarihi: ${new Date(user.createdTimestamp).toLocaleDateString()})`]
                );
            });

            if (detectedFakes.length > 0 || newAccounts.length > 0) {
                const botOwner = await client.users.fetch(process.env.BOT_OWNER_ID);
                let alertMessage = `⚠️ **Şüpheli Oylamalar Tespit Edildi!**\n\n`;

                if (detectedFakes.length > 0) {
                    alertMessage += `🔴 **Fake Oy Kullananlar:**\n`;
                    alertMessage += detectedFakes.map(([userId, count]) => `- <@${userId}> (${count} farklı emojiye bastı)`).join('\n') + '\n\n';
                }

                if (newAccounts.length > 0) {
                    alertMessage += `🟡 **Yeni Açılan Hesaplar (7 günden genç):**\n`;
                    alertMessage += newAccounts.map(user => `- <@${user.id}> (Oluşturulma: <t:${Math.floor(user.createdTimestamp / 1000)}:R>)`).join('\n');
                }

                botOwner.send(alertMessage);
            }

            db.run(`DELETE FROM oylamalar WHERE guild_id = ?`, [interaction.guild.id]);
            db.run(`DELETE FROM adaylar WHERE guild_id = ?`, [interaction.guild.id]);

            return interaction.reply({ content: 'Oylama başarıyla bitirildi!', ephemeral: true });
        });
    }
});

// **Global Hata Yönetimi (Bot Kapanmaz)**
process.on('unhandledRejection', error => {
    console.error('Beklenmeyen Hata:', error);
});

process.on('uncaughtException', error => {
    console.error('Bilinmeyen Hata:', error);
});

// **Botu Başlat**
client.login(process.env.TOKEN);

const express = require('express');
const app = express();
const port = 3100;//buraya karışmayın.

app.get('/', (req, res) => res.send('we discord'));//değiştirebilirsiniz.

app.listen(port, () =>
console.log(`Bot bu adres üzerinde çalışıyor: http://localhost:${port}`)//port
);
