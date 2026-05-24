import { PermissionsBitField } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../../services/guildConfig.js';
import { logEvent } from '../../../utils/moderation.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        // Berechtigungsprüfung auf Deutsch
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Rechte verweigert', 'Du benötigst **Administrator**-Rechte, um den Log-Kanal zu ändern, Amigo.')],
            });
        }

        if (!client.db) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Datenbank-Fehler', 'Die Datenbank ist nicht initialisiert.')],
            });
        }

        const guildId = interaction.guildId;
        const currentConfig = await getGuildConfig(client, guildId);

        const logChannel = interaction.options.getChannel('channel');
        const disableLogging = interaction.options.getBoolean('disable');

        try {
            // Logging deaktivieren
            if (disableLogging) {
                currentConfig.logChannelId = null;
                currentConfig.enableLogging = false;
                currentConfig.logging = {
                    ...(currentConfig.logging || {}),
                    enabled: false,
                    channelId: null,
                };
                await setGuildConfig(client, guildId, currentConfig);
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Logging deaktiviert 🚫', 'Das Audit-Logging wurde für diesen Server vollständig deaktiviert.')],
                });
            }

            // Log-Kanal festlegen
            if (logChannel) {
                const perms = logChannel.permissionsFor(interaction.guild.members.me);
                if (!perms.has(PermissionsBitField.Flags.SendMessages) || !perms.has(PermissionsBitField.Flags.EmbedLinks)) {
                    return InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('Bot-Rechte fehlen', `Ich benötige die Rechte **Nachrichten senden** und **Links einbetten** in ${logChannel}, Loco.`)],
                    });
                }

                currentConfig.logChannelId = logChannel.id;
                currentConfig.enableLogging = true;
                currentConfig.logging = {
                    ...(currentConfig.logging || {}),
                    enabled: true,
                    channelId: logChannel.id,
                };
                await setGuildConfig(client, guildId, currentConfig);

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [successEmbed('Log-Kanal eingerichtet 📝', `Die Audit-Logs werden ab jetzt in den Kanal ${logChannel} gesendet.`)],
                });

                // Internes Audit-Log-Event abfeuern
                await logEvent({
                    client,
                    guild: interaction.guild,
                    event: {
                        action: 'Log-Kanal Aktiviert',
                        target: logChannel.toString(),
                        executor: `${interaction.user.tag} (${interaction.user.id})`,
                        reason: `Logging-Kanal eingerichtet von ${interaction.user}`,
                        metadata: { channelId: logChannel.id, moderatorId: interaction.user.id, loggingEnabled: true },
                    },
                });
                return;
            }

            // Wenn keine Option angegeben wurde
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Option fehlt', 'Bitte gib eine Option an: Entweder einen `channel` (Kanal) oder `disable: True` (Deaktivieren).\n\n> Kanäle für Ticket-Transkripte und Ticket-Logs werden über `/ticket setup` oder `/ticket dashboard` verwaltet.')],
            });
        } catch (error) {
            logger.error('logging setchannel error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Konfigurationsfehler', 'Die Konfiguration konnte nicht gespeichert werden.')],
            });
        }
    },
};
