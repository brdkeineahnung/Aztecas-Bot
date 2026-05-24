import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { 
    selectWinners,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    // Registrierung des Slash-Commands auf Deutsch
    data: new SlashCommandBuilder()
        .setName("vneu")
        .setDescription("Zieht neue Gewinner für eine bereits beendete Verlosung.")
        .addStringOption((option) =>
            option
                .setName("nachrichtenid")
                .setDescription("Die Nachrichten-ID (Message ID) der beendeten Verlosung.")
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
                    "Du gehörst nicht zum Management. Dir fehlen die Rechte, um eine Verlosung neu auszulosen.",
                    { userId: interaction.user.id, guildId: interaction.guildId }
                );
            }

            logger.info(`Giveaway reroll initiated by ${interaction.user.tag} in guild ${interaction.guildId}`);

            const messageId = interaction.options.getString("nachrichtenid");

            
            if (!messageId || !/^\d+$/.test(messageId)) {
                throw new TitanBotError(
                    'Invalid message ID format',
                    ErrorTypes.VALIDATION,
                    'Bitte gib eine gültige Nachrichten-ID an, Loco.',
                    { providedId: messageId }
                );
            }

            const giveaways = await getGuildGiveaways(
                interaction.client,
                interaction.guildId,
            );

            
            const giveaway = giveaways.find(g => g.messageId === messageId);

            if (!giveaway) {
                throw new TitanBotError(
                    `Giveaway not found: ${messageId}`,
                    ErrorTypes.VALIDATION,
                    "Unter dieser ID wurde keine Verlosung in der Datenbank gefunden.",
                    { messageId, guildId: interaction.guildId }
                );
            }

            
            if (!giveaway.isEnded && !giveaway.ended) {
                throw new TitanBotError(
                    `Giveaway still active: ${messageId}`,
                    ErrorTypes.VALIDATION,
                    "Diese Verlosung läuft noch. Nutze zuerst `/vbeenden`, um sie zu stoppen, Amigo.",
                    { messageId, status: 'active' }
                );
            }

            const participants = giveaway.participants || [];
            
            if (participants.length < giveaway.winnerCount) {
                throw new TitanBotError(
                    `Insufficient participants for reroll: ${participants.length} < ${giveaway.winnerCount}`,
                    ErrorTypes.VALIDATION,
                    "Es gibt nicht genug Teilnehmer, um die gewünschte Anzahl an Gewinnern zu ziehen.",
                    { participantsCount: participants.length, winnersNeeded: giveaway.winnerCount }
                );
            }

            
            const newWinners = selectWinners(
                participants,
                giveaway.winnerCount,
            );

            
            const updatedGiveaway = {
                ...giveaway,
                winnerIds: newWinners,
                rerolledAt: new Date().toISOString(),
                rerolledBy: interaction.user.id
            };

            
            const channel = await interaction.client.channels.fetch(
                giveaway.channelId,
            ).catch(err => {
                logger.warn(`Could not fetch channel ${giveaway.channelId}:`, err.message);
                return null;
            });

            if (!channel || !channel.isTextBased()) {
                
                await saveGiveaway(
                    interaction.client,
                    interaction.guildId,
                    updatedGiveaway,
                );
                
                logger.warn(`Could not find channel for giveaway ${messageId}, but saved new winners to database`);
                
                return InteractionHelper.safeReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Auslosung abgeschlossen",
                            "Die neuen Gewinner wurden gezogen und in der Datenbank gespeichert. Der Kanal für die Ankündigung wurde leider nicht gefunden.",
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            
            const message = await channel.messages
                .fetch(messageId)
                .catch(err => {
                    logger.warn(`Could not fetch message ${messageId}:`, err.message);
                    return null;
                });

            if (!message) {
                
                await saveGiveaway(
                    interaction.client,
                    interaction.guildId,
                    updatedGiveaway,
                );

                const winnerMentions = newWinners
                    .map((id) => `<@${id}>`)
                    .join(", ");
                
                
                const existingPingMsg = giveaway.winnerPingMessageId
                    ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
                    : null;
                if (existingPingMsg) {
                    await existingPingMsg.edit({
                        content: `🔄 **NEUE AUSLOSUNG** 🔄 Neue Gewinner für **${giveaway.prize}**: ${winnerMentions}!`,
                    });
                } else {
                    const newPingMsg = await channel.send({
                        content: `🔄 **NEUE AUSLOSUNG** 🔄 Neue Gewinner für **${giveaway.prize}**: ${winnerMentions}!`,
                    });
                    updatedGiveaway.winnerPingMessageId = newPingMsg.id;
                }

                logger.info(`Giveaway rerolled (message not found, but announced): ${messageId}`);

                try {
                    await logEvent({
                        client: interaction.client,
                        guildId: interaction.guildId,
                        eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                        data: {
                            description: `Verlosung neu ausgelost: ${giveaway.prize}`,
                            channelId: giveaway.channelId,
                            userId: interaction.user.id,
                            fields: [
                                {
                                    name: '🎁 Gewinn',
                                    value: giveaway.prize || 'Geheimer Preis!',
                                    inline: true
                                },
                                {
                                    name: '🏆 Neue Gewinner',
                                    value: winnerMentions,
                                    inline: false
                                },
                                {
                                    name: '👥 Teilnehmer gesamt',
                                    value: participants.length.toString(),
                                    inline: true
                                }
                            ]
                        }
                    });
                } catch (logError) {
                    logger.debug('Error logging giveaway reroll:', logError);
                }

                return InteractionHelper.safeReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Auslosung abgeschlossen",
                            `Die neuen Gewinner wurden in ${channel} verkündet. (Die originale Nachricht wurde nicht gefunden).`,
                        ),
                    ],
                    flags: MessageFlags.Ephemeral,
                });
            }

            
            await saveGiveaway(
                interaction.client,
                interaction.guildId,
                updatedGiveaway,
            );

            const newEmbed = createGiveawayEmbed(updatedGiveaway, "reroll", newWinners);
            const newRow = createGiveawayButtons(true);

            await message.edit({
                content: "🔄 **VERLOSUNG NEU AUSGELOST** 🔄",
                embeds: [newEmbed],
                components: [newRow],
            });

            const winnerMentions = newWinners
                .map((id) => `<@${id}>`)
                .join(", ");
            
            
            const existingPingMsg = giveaway.winnerPingMessageId
                ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
                : null;
            if (existingPingMsg) {
                await existingPingMsg.edit({
                    content: `🔄 **NEUE GEWINNER** 🔄 HERZLICHEN GLÜCKWUNSCH ${winnerMentions}! Ihr seid die neuen Gewinner für die Verlosung von **${giveaway.prize}**! Meldet euch bei <@${giveaway.hostId}>, um euren Gewinn abzuholen!`,
                });
            } else {
                const newPingMsg = await channel.send({
                    content: `🔄 **NEUE GEWINNER** 🔄 HERZLICHEN GLÜCKWUNSCH ${winnerMentions}! Ihr seid die neuen Gewinner für die Verlosung von **${giveaway.prize}**! Meldet euch bei <@${giveaway.hostId}>, um euren Gewinn abzuholen!`,
                });
                updatedGiveaway.winnerPingMessageId = newPingMsg.id;
            }

            logger.info(`Giveaway successfully rerolled: ${messageId} with ${newWinners.length} new winners`);

            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                    data: {
                        description: `Verlosung neu ausgelost: ${giveaway.prize}`,
                        channelId: giveaway.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Gewinn',
                                value: giveaway.prize || 'Geheimer Preis!',
                                inline: true
                            },
                            {
                                name: '🏆 Neue Gewinner',
                                value: winnerMentions,
                                inline: false
                            },
                            {
                                name: '👥 Teilnehmer gesamt',
                                value: participants.length.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway reroll event:', logError);
            }

            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        "Neu ausgelost ✅",
                        `Die Verlosung für **${giveaway.prize}** in ${channel} wurde erfolgreich neu ausgelost. Es wurden **${newWinners.length}** neue Gewinner gezogen.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

        } catch (error) {
            logger.error('Error in greroll command:', error);
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'vneu',
                context: 'giveaway_reroll'
            });
        }
    },
};



