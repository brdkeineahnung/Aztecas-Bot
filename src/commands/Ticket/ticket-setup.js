import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    MessageFlags 
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Erstellt das Aztecas Multi-Ticket-System')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Wo soll das Panel hin?')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('In welcher Kategorie sollen die Tickets landen?')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('team-role')
                .setDescription('Welche Rolle bearbeitet die Tickets?')
                .setRequired(true)),

    async execute(interaction) {
        // Direktes Aufschieben über Standard-Discord.js (Verhindert "Anwendung reagiert nicht")
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

        const targetChannel = interaction.options.getChannel('channel');
        const category = interaction.options.getChannel('category');
        const teamRole = interaction.options.getRole('team-role');

        try {
            const panelEmbed = new EmbedBuilder()
                .setColor('#00FFFF')
                .setTitle('🦅 AZTECAS | FUNKZENTRALE')
                .setDescription(
                    '¡Hola Hermano! Du hast ein Anliegen? Wähle die passende Frequenz im Menü unten aus.\n\n' +
                    '📩 **Bewerbung:** Du willst Blut für die Aztecas vergießen?\n' +
                    '🛠️ **Support:** Probleme im Barrio oder mit dem Funk?\n' +
                    '📁 **Sonstiges:** Alles, was in keine Schublade passt.\n\n' +
                    '*Missbrauch wird mit einem Ticket in die Wüste bestraft!*'
                )
                .setTimestamp();

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`ticket_select:${teamRole.id}:${category.id}`)
                .setPlaceholder('Wähle dein Anliegen...')
                .addOptions([
                    { label: 'Bewerbung', description: 'Werde Teil der Familie', value: 'bewerbung', emoji: '📝' },
                    { label: 'Support / Hilfe', description: 'Probleme oder Fragen', value: 'support', emoji: '🛠️' },
                    { label: 'Sonstiges / Beschwerde', description: 'Alles andere', value: 'sonstiges', emoji: '📁' },
                ]);

            const row = new ActionRowBuilder().addComponents(menu);

            await targetChannel.send({ embeds: [panelEmbed], components: [row] });
            await interaction.editReply({ content: '✅ Multi-Ticket-System eingerichtet!' });

        } catch (error) {
            console.error('Fehler beim Setup:', error);
            await interaction.editReply({ content: '❌ Setup fehlgeschlagen. Überprüfe die Bot-Rechte.' });
        }
    }
};
