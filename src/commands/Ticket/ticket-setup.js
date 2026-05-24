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
        .setDescription('Erstellt das optimierte Ticket-Support-Panel')
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
            // Das neue, stark verbesserte Aztecas-Embed
            const panelEmbed = new EmbedBuilder()
                .setColor('#00FFFF') // Markantes Aztecas-Türkis
                .setTitle('🦅 AZTECAS HAUPTQUARTIER')
                .setDescription(
                    '💥 **Zentraler Support- & Funkdienst**\n' +
                    'Du hast ein dringendes Anliegen, ein wichtiges Geschäft zu besprechen oder benötigst die Aufmerksamkeit der Führungsebene? Hier bist du richtig.\n\n' +
                    '📌 **Hinweise vor dem Öffnen:**\n' +
                    '• Beschreibe dein Anliegen direkt sachlich und präzise.\n' +
                    '• Unnötiges Spammen oder Missbrauch des Funks wird sanktioniert.\n\n' +
                    '*Klicke auf den Button unten, um eine geschützte Verbindung herzustellen.*'
                )
                .addFields({ name: '⚡ Status', value: '🟢 Bereit / Online', inline: true })
                .setTimestamp()
                .setFooter({ text: 'Barrio Netzwerksicherheit', iconURL: interaction.guild.iconURL() });

            // Button-Daten (IDs werden in der customId gespeichert, um die DB zu entlasten)
            const openButton = new ButtonBuilder()
                .setCustomId(`ticket_open:${teamRole.id}:${category.id}`)
                .setLabel('Funkverbindung aufbauen')
                .setEmoji('📟')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(openButton);

            await targetChannel.send({ embeds: [panelEmbed], components: [row] });

            logger.info(`[Ticket] Setup abgeschlossen von ${interaction.user.tag} in ${interaction.guild.name}`);

            await InteractionHelper.safeEditReply(interaction, {
                content: `✅ Das neue Ticket-Panel wurde erfolgreich in ${targetChannel} eingerichtet!`
            });

        } catch (error) {
            logger.error('[Ticket] Fehler beim Ticket-Setup:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Setup fehlgeschlagen', 'Das Panel konnte nicht gesendet werden.')]
            });
        }
    }
};
