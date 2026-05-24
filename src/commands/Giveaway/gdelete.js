import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { getGuildGiveaways, deleteGiveaway } from '../../utils/giveaways.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    // Registrierung des Slash-Commands auf Deutsch
    data: new SlashCommandBuilder()
        .setName("vloeschen")
        .setDescription("Löscht eine aktive Verlosung und entfernt sie aus der Datenbank.")
        .addStringOption((option) =>
            option
                .setName("nachrichtenid")
                .setDescription("Die Nachrichten-ID (Message ID) der Verlosung, die gelöscht werden soll.")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        try {
            
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Giveaway command used outside guild',
                    ErrorTypes.VALIDATION,
                    'Dieser Befehl kann nur auf dem Aztecas-Server genutzt werden, Amigo.',
                    { userId: interaction.user.id }
                );
            }

            
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                throw new TitanBotError(
                    'User lacks ManageGuild permission',
                    ErrorTypes.PERMISSION,
                    "Du gehörst nicht zum Management. Dir fehlen die Rechte, um Verlosungen zu löschen.",
                    { userId: interaction.user.id, guildId: interaction.guildId }
                );
            }

            logger.info(`Giveaway deletion started by ${interaction.user.tag} in guild ${interaction.guildId}`);

            const messageId = interaction.options.getString("nachrichtenid");

            
            if (!messageId || !/^\d+$/.test(messageId)) {
                throw new TitanBotError(
                    'Invalid message ID format',
                    ErrorTypes.VALIDATION,
                    'Bitte gib eine gültige Nachrichten-ID an, Loco.',
                    { providedId: messageId }
                );
            }

            const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
            const giveaway = giveaways.find(g => g.messageId === messageId);

            if (!giveaway) {
                throw new TitanBotError(
                    `Giveaway not found: ${messageId}`,
                    ErrorTypes.VALIDATION,
                    "Unter dieser ID wurde keine Verlosung gefunden.",
                    { messageId, guildId: interaction.guildId }
                );
            }

            let deletedMessage = false;
            let channelName = "Unbekannter Kanal";

            const tryDeleteFromChannel = async (channel) => {
                if (!channel || !channel.isTextBased() || !channel.messages?.fetch) {
                    return false;
                }

                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (!message) {
                    return false;
                }

                await message.delete();
                channelName = channel.name || 'unbekannter-kanal';
                deletedMessage = true;
                return true;
            };

            
            try {
                const channel = await interaction.client.channels.fetch(giveaway.channelId).catch(() => null);
                if (await tryDeleteFromChannel(channel)) {
                    logger.debug(`Deleted giveaway message ${messageId} from channel ${channelName}`);
                }

                if (!deletedMessage && interaction.guild) {
                    const textChannels = interaction.guild.channels.cache.filter(
                        ch => ch.id !== giveaway.channelId && ch.isTextBased() && ch.messages?.fetch
                    );

                    for (const [, guildChannel] of textChannels) {
                        const foundAndDeleted = await tryDeleteFromChannel(guildChannel).catch(() => false);
                        if (foundAndDeleted) {
                            logger.debug(`Deleted giveaway message ${messageId} via fallback lookup in #${channelName}`);
                            break;
                        }
                    }
                }
            } catch (error) {
                logger.warn(`Could not delete giveaway message: ${error.message}`);
            }

            
            const removedFromDatabase = await deleteGiveaway(
                interaction.client,
                interaction.guildId,
                messageId,
            );

            if (!removedFromDatabase) {
                throw new TitanBotError(
                    `Failed to delete giveaway from database: ${messageId}`,
                    ErrorTypes.UNKNOWN,
                    'Die Verlosung konnte nicht aus der Datenbank gelöscht werden. Versuch es noch einmal.',
                    { messageId, guildId: interaction.guildId }
                );
            }

            const giveawaysAfterDelete = await getGuildGiveaways(interaction.client, interaction.guildId);
            const stillExistsInDatabase = giveawaysAfterDelete.some(g => g.messageId === messageId);

            if (stillExistsInDatabase) {
                throw new TitanBotError(
                    `Giveaway still exists after deletion: ${messageId}`,
                    ErrorTypes.UNKNOWN,
                    'Löschen fehlgeschlagen. Die Daten sind immer noch in der Datenbank.',
                    { messageId, guildId: interaction.guildId }
                );
            }

            const statusMsg = deletedMessage
                ? `und die Nachricht wurde aus #${channelName} entfernt`
                : `aber die Nachricht war bereits gelöscht oder der Kanal ist nicht erreichbar.`;

            const winnerIds = Array.isArray(giveaway.winnerIds) ? giveaway.winnerIds : [];
            const hasWinners = winnerIds.length > 0;
            const wasEnded = giveaway.ended === true || giveaway.isEnded === true || hasWinners;

            const winnerStatusMsg = hasWinners
                ? `Bei dieser Verlosung wurden bereits ${winnerIds.length} Gewinner ermittelt.`
                : wasEnded
                    ? 'Diese Verlosung wurde ohne gültige Gewinner beendet.'
                    : 'Es wurde vor dem Löschen kein Gewinner gezogen.';

            logger.info(`Giveaway deleted: ${messageId} in ${channelName}`);

            
            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_DELETE,
                    data: {
                        description: `Verlosung gelöscht: ${giveaway.prize}`,
                        channelId: giveaway.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Gewinn',
                                value: giveaway.prize || 'Unbekannt',
                                inline: true
                            },
                            {
                                name: '📊 Teilnehmeranzahl',
                                value: (giveaway.participants?.length || 0).toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway deletion:', logError);
            }

            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        "Verlosung gelöscht",
                        `Die Verlosung für **${giveaway.prize}** wurde erfolgreich beendet ${statusMsg}. ${winnerStatusMsg}`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

        } catch (error) {
            logger.error('Error in gdelete command:', error);
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'vloeschen',
                context: 'giveaway_deletion'
            });
        }
    },
};
