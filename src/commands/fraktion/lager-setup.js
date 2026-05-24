import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('lager-setup')
        .setDescription('Erstellt das digitale Fraktionslager')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option.setName('channel').setDescription('Kanal für das Lager-Panel').addChannelTypes(ChannelType.GuildText).setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const channel = interaction.options.getChannel('channel');

        const embed = new EmbedBuilder()
            .setColor('#00FFFF')
            .setTitle('📦 AZTECAS FRAKTIONSLAGER')
            .setDescription('Hier wird der aktuelle Bestand an Ausrüstung im Barrio dokumentiert.')
            .addFields(
                { name: '🟢 Schutzwesten', value: '📦 Anzahl: `0`', inline: true },
                { name: '🟢 Medkits', value: '📦 Anzahl: `0`', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Kammer-Logbuch' });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lager_add_westen').setLabel('+ Weste').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('lager_remove_westen').setLabel('- Weste').setStyle(ButtonStyle.Danger)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lager_add_medkits').setLabel('+ Medkit').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('lager_remove_medkits').setLabel('- Medkit').setStyle(ButtonStyle.Danger)
        );

        try {
            await channel.send({ embeds: [embed], components: [row1, row2] });
            await interaction.editReply({ content: '✅ Fraktionslager erfolgreich bereitgestellt!' });
        } catch (error) {
            await interaction.editReply({ content: '❌ Fehler beim Erstellen des Lagers.' });
        }
    }
};
