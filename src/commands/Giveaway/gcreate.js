import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError } from '../../utils/errorHandler.js';
import { saveGiveaway } from '../../utils/giveaways.js';
import { 
    parseDuration, 
    validatePrize, 
    validateWinnerCount,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    // Registrierung des Slash-Commands auf Deutsch
    data: new SlashCommandBuilder()
        .setName("verlosung")
        .setDescription("Startet eine neue Verlosung im Barrio.")
        .addStringOption((option) =>
            option
                .setName("dauer")
                .setDescription(
                    "Wie lange die Verlosung gehen soll (z.B. 1h, 30m, 5d).",
                )
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("gewinner")
                .setDescription("Die Anzahl der gezogenen Gewinner.")
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("preis")
                .setDescription("Der Gegenstand / Betrag, der verlost wird.")
                .setRequired(true),
        )
        .addChannelOption((option) =>
            option
                .setName("kanal")
                .setDescription("Der Kanal, in den die Verlosung gepostet wird (Standard: aktueller Kanal).")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false),
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
                    "Du gehörst nicht zum Management. Dir fehlen die Rechte für eine Verlosung.",
                    { userId: interaction.user.id, guildId: interaction.guildId }
                );
            }

            logger.info(`Giveaway creation started by ${interaction.user.tag} in guild ${interaction.guildId}`);

            
            const durationString = interaction.options.getString("dauer");
            const winnerCount = interaction.options.getInteger("gewinner");
            const prize = interaction.options.getString("preis");
            const targetChannel = interaction.options.getChannel("kanal") || interaction.channel;

            
            const durationMs = parseDuration(durationString);
            validateWinnerCount(winnerCount);
            const prizeName = validatePrize(prize);

            
            if (!targetChannel.isTextBased()) {
                throw new TitanBotError(
                    'Target channel is not text-based',
                    ErrorTypes.VALIDATION,
                    'Das muss ein normaler Textkanal sein, Loco.',
                    { channelId: targetChannel.id, channelType: targetChannel.type }
                );
            }

            const endTime = Date.now() + durationMs;

            
            const initialGiveawayData = {
                messageId: "placeholder",
                channelId: targetChannel.id,
                guildId: interaction.guildId,
                prize: prizeName,
                hostId: interaction.user.id,
                endTime: endTime,
                endsAt: endTime,
                winnerCount: winnerCount,
                participants: [],
                isEnded: false,
                ended: false,
                createdAt: new Date().toISOString()
            };

            
            const embed = createGiveawayEmbed(initialGiveawayData, "active");
            const row = createGiveawayButtons(false);
            
            
            const giveawayMessage = await targetChannel.send({
                content: "🎉 **NEUE VERLOSUNG IM BARRIO** 🎉",
                embeds: [embed],
                components: [row],
            });

            
            initialGiveawayData.messageId = giveawayMessage.id;
            const saved = await saveGiveaway(
                interaction.client,
                interaction.guildId,
                initialGiveawayData,
            );

            if (!saved) {
                logger.warn(`Failed to save giveaway to database: ${giveawayMessage.id}`);
            }

            
            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_CREATE,
                    data: {
                        description: `Verlosung gestartet von: ${prizeName}`,
                        channelId: targetChannel.id,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Gewinn',
                                value: prizeName,
                                inline: true
                            },
                            {
                                name: '🏆 Gewinneranzahl',
                                value: winnerCount.toString(),
                                inline: true
                            },
                            {
                                name: '⏰ Laufzeit',
                                value: durationString,
                                inline: true
                            },
                            {
                                name: '📍 Barrio-Kanal',
                                value: targetChannel.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway creation event:', logError);
            }

            logger.info(`Giveaway created successfully: ${giveawayMessage.id} in ${targetChannel.name}`);

            
            await InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        `Verlosung gestartet! 🎉`,
                        `Eine neue Verlosung für **${prizeName}** wurde erfolgreich in ${targetChannel} gestartet und endet in **${durationString}**.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

        } catch (error) {
            await handleInteractionError(interaction, error, {
                type: 'command',
                commandName: 'verlosung',
                context: 'giveaway_creation'
            });
        }
    },
};


