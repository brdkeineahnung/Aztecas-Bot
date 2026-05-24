import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('lager-setup')
        .setDescription('Erstellt die digitale Fraktionskammer')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Kanal für das Lager')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)),

    async execute(interaction) {
        // Sicheres, standardmäßiges Antworten, damit Discord nicht abstürzt
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const channel = interaction.options.getChannel('channel');

        const embed = new EmbedBuilder()
            .setColor('#00FFFF')
            .setTitle('📦 AZTECAS | FRAKTIONSLAGER')
            .setDescription('Dokumentation der aktuellen Bestände im Barrio. Nutze die Buttons zum Ein- und Auslagern.')
            .addFields(
                { name: '🟢 Schutzwesten', value: ' Anzahlen: `0`', inline: true },
                { name: '🟢 Medkits', value: ' Anzahlen: `0`', inline: true }
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
            console.error(error);
            await interaction.editReply({ content: '❌ Fehler beim Senden des Lagers. Fehlende Bot-Rechte im Kanal?' });
        }
    }
};
