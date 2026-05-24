import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticketPermissions.js';
import { updateTicketPriority } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("priority")
        .setDescription("Setzt die Prioritätsstufe für das aktuelle Support-Ticket.")
        .addStringOption((option) =>
            option
                .setName("level")
                .setDescription("Die Prioritätsstufe für das Ticket.")
                .setRequired(true)
                .addChoices(
                    { name: "🔴 Dringend", value: "urgent" },
                    { name: "🟠 Hoch", value: "high" },
                    { name: "🟡 Mittel", value: "medium" },
                    { name: "🟢 Niedrig", value: "low" },
                    { name: "⚪ Keine", value: "none" },
                ),
        )
        .setDMPermission(false),
    category: "Ticket",

    async execute(interaction, guildConfig, client) {
        try {
            
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) {
                return;
            }

            const permissionContext = await getTicketPermissionContext({ client, interaction });
            if (!permissionContext.ticketData) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Kein Ticket-Kanal",
                            "Dieser Befehl kann nur in einem gültigen Ticket-Kanal verwendet werden.",
                        ),
                    ],
                });
            }

            if (!permissionContext.canManageTicket) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Zugriff verweigert",
                            "Du benötigst die Berechtigung `Kanäle verwalten` oder die konfigurierte `Team-Rolle`, um die Ticket-Priorität zu ändern.",
                        ),
                    ],
                });
            }

            const priorityLevel = interaction.options.getString("level");
            const result = await updateTicketPriority(interaction.channel, priorityLevel, interaction.user);
            
            if (!result.success) {
                logger.warn('Prioritäts-Update fehlgeschlagen - Kein gültiger Ticket-Kanal', {
                    userId: interaction.user.id,
                    channelId: interaction.channel.id,
                    guildId: interaction.guildId,
                    error: result.error
                });
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Kein Ticket-Kanal",
                            result.error || "Dieser Befehl kann nur in einem gültigen Ticket-Kanal verwendet werden.",
                        ),
                    ],
                });
            }

            // Übersetzung der internen Values für die Erfolgsmeldung im Discord-Interface
            const priorityNames = {
                urgent: "DRINGEND",
                high: "HOCH",
                medium: "MITTEL",
                low: "NIEDRIG",
                none: "KEINE"
            };

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "Priorität aktualisiert",
                        `Die Ticket-Priorität wurde erfolgreich auf **${priorityNames[priorityLevel] || priorityLevel.toUpperCase()}** gesetzt.`,
                    ),
                ],
            });

            logger.info('Ticket-Priorität erfolgreich aktualisiert', {
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                channelId: interaction.channel.id,
                channelName: interaction.channel.name,
                guildId: interaction.guildId,
                priority: priorityLevel,
                commandName: 'priority'
            });

        } catch (error) {
            logger.error('Fehler beim Ausführen des Priority-Befehls', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                channelId: interaction.channel?.id,
                guildId: interaction.guildId,
                commandName: 'priority'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'priority',
                source: 'ticket_priority_command'
            });
        }
    },
};



