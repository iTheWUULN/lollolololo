require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('oylama-başlat')
        .setDescription('Yeni bir oylama başlat')
        .addChannelOption(option => option.setName('kanal').setDescription('Oylamanın yapılacağı kanal').setRequired(true)),

    new SlashCommandBuilder()
        .setName('oylama-aday-ekle')
        .setDescription('Oylamaya aday ekle')
        .addStringOption(option => option.setName('sunucu').setDescription('Sunucu adı').setRequired(true))
        .addStringOption(option => option.setName('tepki').setDescription('Emoji tepki').setRequired(true)),

    new SlashCommandBuilder()
        .setName('oylama-bitir')
        .setDescription('Oylamayı bitir ve sonuçları açıkla'),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands })
    .then(() => console.log('✅ Komutlar yüklendi!'))
    .catch(console.error);
