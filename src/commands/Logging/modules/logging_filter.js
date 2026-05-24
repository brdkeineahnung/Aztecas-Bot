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
                embeds: [errorEmbed('Rechte verweigert', 'Du benötigst **Administrator**-Rechte, um die Log-Filter zu verwalten, Amigo.')],
            });
        }

        if (!client.db) {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Datenbank-Fehler', 'Die Datenbank ist nicht initialisiert.')],
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const type = interaction.options.getString('type');
        const entityId = interaction.options.getString('id');
        const guildId = interaction.guildId;

        const currentConfig = await getGuildConfig(client, guildId);
        if (!currentConfig.logIgnore) {
            currentConfig.logIgnore = { users: [], channels: [] };
        }

        let targetArray;
        let entityType;
        let entityName;

        // Übersetzung der Entitätstypen für die Embeds
        if (type === 'user') {
            targetArray = currentConfig.logIgnore.users;
            entityType = 'Benutzer';
            const member = await interaction.guild.members.fetch(entityId).catch(() => null);
            entityName = member ? member.user.tag : `ID: ${entityId}`;
        } else if (type === 'channel') {
            targetArray = currentConfig.logIgnore.channels;
            entityType = 'Kanal';
            const channel = interaction.guild.channels.cache.get(entityId);
            entityName = channel ? `#${channel.name}` : `ID: ${entityId}`;
        } else {
            return InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Ungültiger Typ', "Wähle entweder `user` (Benutzer) oder `channel` (Kanal).")],
            });
        }

        let successMessage;

        // Logik für das Hinzufügen/Entfernen mit deutschen Rückmeldungen
        if (subcommand === 'add') {
            if (targetArray.includes(entityId)) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Bereits gefiltert', 'Kein Stress, Loco! Dieser ' + entityType + ' **' + entityName + '** steht bereits auf der Ignorierliste.')],
                });
            }
            targetArray.push(entityId);
            successMessage = `Der ${entityType} **${entityName}** wurde zur Ignorierliste hinzugefügt. Ereignisse von dort werden ab jetzt nicht mehr geloggt.`;
        } else if (subcommand === 'remove') {
            const index = targetArray.indexOf(entityId);
            if (index === -1) {
                return InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Nicht gefiltert', `Dieser ${entityType} **${entityName}** war gar nicht auf der Ignorierliste.`)],
                });
            }
            targetArray.splice(index, 1);
            successMessage = `Der ${entityType} **${entityName}** wurde von der Ignorierliste entfernt. Ereignisse werden ab jetzt wieder ordnungsgemäß geloggt.`;
        } else {
            return;
        }

        try {
            await setGuildConfig(client, guildId, currentConfig);

            // Internes Audit-Log-Event
            await logEvent({
                client,
                guild: interaction.guild,
                event: {
                    action: 'Log-Filter Aktualisiert',
                    target: `Filter ${subcommand === 'add' ? 'Hinzugefügt' : 'Entfernt'}`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    metadata: { entityType, loggingEnabled: currentConfig.enableLogging },
                },
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [successEmbed('Filter aktualisiert ✅', successMessage)],
            });
        } catch (error) {
            logger.error('logging filter error:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Datenbank-Fehler', 'Die Filteränderung konnte nicht gespeichert werden.')],
            });
        }
    },
};
