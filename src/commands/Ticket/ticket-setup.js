import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags 
} from 'discord.js';
import { getColor } from '../../config/bot.js';
import { errorEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Erstellt das Ticket-Support-Panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('In welchem Kanal soll das Panel gesendet werden?')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('team-role')
                .setDescription('Welche Rolle hat Zugriff auf die Tickets?')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('In welcher Kategorie sollen Tickets geöffnet werden?')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true)),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) return;

        const targetChannel = interaction.options.getChannel('channel');
        const teamRole = interaction.options.getRole('team-role');
        const category = interaction.options.getChannel('category');

        try {
            // Das Design des Ticket-Panels (Aztecas / Fraktions-Style)
            const panelEmbed = new EmbedBuilder()
                .setColor(getColor('primary') || '#00FFFF')
                .setTitle('🦅 Aztecas Hauptquartier – Support & Anfragen')
                .setDescription(
                    'Du musst ein wichtiges Geschäft besprechen, hast Probleme im Barrio oder willst ein Anliegen einreichen?\n\n' +
                    'Klicke auf den Button unten, um einen abhörsicheren Funkkanal zu öffnen. Die Führungsebene wird sich um dich kümmern.'
                )
                .setFooter({ text: 'Missbrauch des Ticket-Systems wird bestraft.' });

            // Der Button zum Öffnen. Die customId speichert wichtige Infos für später!
            const openButton = new ButtonBuilder()
                .setCustomId(`ticket_open:${teamRole.id}:${category.id}`)
                .setLabel('✉️ Funkkanal öffnen')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(openButton);

            // Panel in den Zielkanal senden
            await targetChannel.send({ embeds: [panelEmbed], components: [row] });

            logger.info(`[Ticket] Setup abgeschlossen von ${interaction.user.tag} in ${interaction.guild.name}`);

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ Das Ticket-Panel wurde erfolgreich in ${targetChannel} eingerichtet!`
            });

        } catch (error) {
            logger.error('[Ticket] Fehler beim Ticket-Setup:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Setup fehlgeschlagen', 'Das Panel konnte nicht gesendet werden.')]
            });
        }
    }
};
