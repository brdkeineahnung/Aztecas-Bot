import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { 
    endGiveaway as endGiveawayService,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    // Registrierung des Slash-Commands auf Deutsch
    data: new SlashCommandBuilder()
        .setName("vbeenden")
        .setDescription("Beendet eine aktive Verlosung sofort und zieht die Gewinner.")
        .addStringOption((option) =>
            option
                .setName("nachrichtenid")
                .setDescription("Die Nachrichten-ID (Message ID) der Verlosung, die beendet werden soll.")
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
                    "Du gehörst nicht zum Management. Dir fehlen die Rechte, um Verlosungen zu beenden.",
                    { userId: interaction.user.id, guildId: interaction.guildId }
                );
            }

            logger.info(`Giveaway end initiated by ${interaction.user.tag} in guild ${interaction.guildId}`);

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
                    "Unter dieser ID wurde keine aktive Verlosung in der Datenbank gefunden.",
                    { messageId, guildId: interaction.guildId }
                );
            }

            
            const endResult = await endGiveawayService(
                interaction.client,
                giveaway,
                interaction.guildId,
                interaction.user.id
            );

            const updatedGiveaway = endResult.giveaway;
            const winners = endResult.winners;

            
            const channel = await interaction.client.channels.fetch(
                updatedGiveaway.channelId,
            ).catch(err => {
                logger.warn(`Could not fetch channel ${updatedGiveaway.channelId}:`, err.message);
                return null;
            });

            if (!channel || !channel.isTextBased()) {
                throw new TitanBotError(
                    `Channel not found: ${updatedGiveaway.channelId}`,
                    ErrorTypes.VALIDATION,
                    "Der Kanal der Verlosung wurde nicht gefunden. Der Status in der Datenbank wurde trotzdem aktualisiert.",
                    { channelId: updatedGiveaway.channelId, messageId }
                );
            }

            const message = await channel.messages
                .fetch(messageId)
                .catch(err => {
                    logger.warn(`Could not fetch message ${messageId}:`, err.message);
                    return null;
                });

            if (!message) {
                throw new TitanBotError(
                    `Message not found: ${messageId}`,
                    ErrorTypes.VALIDATION,
                    "Die originale Nachricht der Verlosung wurde nicht gefunden. Der Status wurde trotzdem aktualisiert.",
                    { messageId, channelId: updatedGiveaway.channelId }
                );
            }

            
            await saveGiveaway(
                interaction.client,
                interaction.guildId,
                updatedGiveaway,
            );

            
            const newEmbed = createGiveawayEmbed(updatedGiveaway, "ended", winners);
            const newRow = createGiveawayButtons(true);

            await message.edit({
                content: "🎉 **VERLOSUNG BEENDET** 🎉",
                embeds: [newEmbed],
                components: [newRow],
            });

            
            if (winners.length > 0) {
                const winnerMentions = winners
                    .map((id) => `<@${id}>`)
                    .join(", ");
                const winnerPingMsg = await channel.send({
                    content: `🎉 **HERZLICHEN GLÜCKWUNSCH** ${winnerMentions}! Du hast die Verlosung für **${updatedGiveaway.prize}** gewonnen! Melde dich im Barrio bei <@${updatedGiveaway.hostId}>, um deinen Gewinn abzuholen!`,
                });
                updatedGiveaway.winnerPingMessageId = winnerPingMsg.id;
                await saveGiveaway(interaction.client, interaction.guildId, updatedGiveaway);

                logger.info(`Giveaway ended with ${winners.length} winner(s): ${messageId}`);

                
                try {
                    await logEvent({
                        client: interaction.client,
                        guildId: interaction.guildId,
                        eventType: EVENT_TYPES.GIVEAWAY_WINNER,
                        data: {
                            description: `Verlosung beendet mit ${winners.length} Gewinner(n)`,
                            channelId: channel.id,
                            userId: interaction.user.id,
                            fields: [
                                {
                                    name: '🎁 Gewinn',
                                    value: updatedGiveaway.prize || 'Geheimer Preis!',
                                    inline: true
                                },
                                {
                                    name: '🏆 Gewinner',
                                    value: winnerMentions,
                                    inline: false
                                },
                                {
                                    name: '👥 Teilnehmer',
                                    value: endResult.participantCount.toString(),
                                    inline: true
                                }
                            ]
                        }
                    });
                } catch (logError) {
                    logger.debug('Error logging giveaway winner event:', logError);
                }
            } else {
                await channel.send({
                    content: `Die Verlosung für **${updatedGiveaway.prize}** ist beendet, aber es gab keine gültigen Teilnehmer, Amigos.`,
                });
                logger.info(`Giveaway ended with no winners: ${messageId}`);
            }

            logger.info(`Giveaway successfully ended by ${interaction.user.tag}: ${messageId}`);

            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        "Verlosung beendet ✅",
                        `Die Verlosung für **${updatedGiveaway.prize}** in ${channel} wurde erfolgreich beendet. Es wurden **${winners.length}** Gewinner aus insgesamt **${endResult.participantCount}** Einträgen gezogen.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

        } catch (error) {
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'vbeenden',
                context: 'giveaway_end'
            });
        }
    },
};


