import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { getWelcomeConfig, saveWelcomeConfig } from '../../../utils/database.js';
import { botHasPermission } from '../../../utils/permissionGuard.js';

// ─── Embed & Menu Builders ────────────────────────────────────────────────────

function buildDashboardEmbed(cfg, guild) {
    const welcomeChannel = cfg.channelId ? `<#${cfg.channelId}>` : '`Not set`';
    const goodbyeChannel = cfg.goodbyeChannelId ? `<#${cfg.goodbyeChannelId}>` : '`Not set`';

    const rawWelcome = cfg.welcomeMessage || 'Welcome {user} to {server}!';
    const rawGoodbye = cfg.leaveMessage || '{user.tag} has left the server.';
    const welcomePreview = `\`${rawWelcome.length > 55 ? rawWelcome.substring(0, 55) + '…' : rawWelcome}\``;
    const goodbyePreview = `\`${rawGoodbye.length > 55 ? rawGoodbye.substring(0, 55) + '…' : rawGoodbye}\``;

    return new EmbedBuilder()
        .setTitle('👋 Greet System Dashboard')
        .setDescription(`Manage welcome & goodbye settings for **${guild.name}**.\nUse the toggles to enable/disable each side, then select an option to edit.`)
        .setColor(getColor('info'))
        .addFields(
            { name: '🟢 Welcome Channel', value: welcomeChannel, inline: true },
            { name: '⚙️ Welcome Status', value: cfg.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: '🔔 Welcome Ping', value: cfg.welcomePing ? '✅ On' : '❌ Off', inline: true },
            { name: '🔴 Goodbye Channel', value: goodbyeChannel, inline: true },
            { name: '⚙️ Goodbye Status', value: cfg.goodbyeEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: '🔔 Goodbye Ping', value: cfg.goodbyePing ? '✅ On' : '❌ Off', inline: true },
            { name: '💬 Welcome Message', value: welcomePreview, inline: false },
            { name: '💬 Goodbye Message', value: goodbyePreview, inline: false },
        )
        .setFooter({ text: 'Dashboard closes after 10 minutes of inactivity' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`greet_cfg_${guildId}`)
        .setPlaceholder('Select a setting to configure...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Welcome Channel')
                .setDescription('Set the channel where welcome messages are sent')
                .setValue('welcome_channel')
                .setEmoji('🟢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Welcome Message')
                .setDescription('Edit the text shown when a member joins')
                .setValue('welcome_message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Welcome Image URL')
                .setDescription('Set the image for welcome messages')
                .setValue('welcome_image')
                .setEmoji('🖼️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Goodbye Channel')
                .setDescription('Set the channel where goodbye messages are sent')
                .setValue('goodbye_channel')
                .setEmoji('🔴'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Goodbye Message')
                .setDescription('Edit the text shown when a member leaves')
                .setValue('goodbye_message')
                .setEmoji('💬'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Goodbye Image URL')
                .setDescription('Set the image for goodbye messages')
                .setValue('goodbye_image')
                .setEmoji('🖼️'),
        );
}

function buildButtonRow(cfg, guildId, disabled = false) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`greet_cfg_toggle_welcome_${guildId}`)
                .setLabel('Welcome')
                .setStyle(cfg.enabled ? ButtonStyle.Success : ButtonStyle.Danger)
                .setEmoji('🟢')
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId(`greet_cfg_toggle_goodbye_${guildId}`)
                .setLabel('Goodbye')
                .setStyle(cfg.goodbyeEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
                .setEmoji('🔴')
                .setDisabled(disabled),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`greet_cfg_ping_welcome_${guildId}`)
                .setLabel('Ping Welcome')
                .setStyle(cfg.welcomePing ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔔')
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId(`greet_cfg_ping_goodbye_${guildId}`)
                .setLabel('Ping Goodbye')
                .setStyle(cfg.goodbyePing ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setEmoji('🔔')
                .setDisabled(disabled),
        ),
    ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function refreshDashboard(rootInteraction, cfg, guildId) {
    try {
        const selectMenu = buildSelectMenu(guildId);
        await InteractionHelper.safeEditReply(rootInteraction, {
            embeds: [buildDashboardEmbed(cfg, rootInteraction.guild)],
            components: [
                ...buildButtonRow(cfg, guildId),
                new ActionRowBuilder().addComponents(selectMenu),
            ],
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        logger.debug('Could not refresh greet dashboard:', error.message);
    }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default {
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const cfg = await getWelcomeConfig(client, guildId);

            if (!cfg.channelId && !cfg.goodbyeChannelId) {
                throw new TitanBotError(
                    'Greet system not configured',
                    ErrorTypes.CONFIGURATION,
                    'Neither Welcome nor Goodbye has been set up yet. Run `/welcome setup` or `/goodbye setup` first.',
                );
            }

            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

            const selectMenu = buildSelectMenu(guildId);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [buildDashboardEmbed(cfg, interaction.guild)],
                components: [
                    ...buildButtonRow(cfg, guildId),
                    new ActionRowBuilder().addComponents(selectMenu),
                ],
                flags: MessageFlags.Ephemeral,
            });

            // ── Select collector ──────────────────────────────────────────────
            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: i => i.user.id === interaction.user.id && i.customId === `greet_cfg_${guildId}`,
                time: 600_000,
            });

            collector.on('collect', async selectInteraction => {
                const selectedOption = selectInteraction.values[0];
                try {
                    switch (selectedOption) {
                        case 'welcome_channel':
                            await handleWelcomeChannel(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'welcome_message':
                            await handleWelcomeMessage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'welcome_image':
                            await handleImageModal(selectInteraction, interaction, cfg, guildId, client, 'welcome');
                            break;
                        case 'goodbye_channel':
                            await handleGoodbyeChannel(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'goodbye_message':
                            await handleGoodbyeMessage(selectInteraction, interaction, cfg, guildId, client);
                            break;
                        case 'goodbye_image':
                            await handleImageModal(selectInteraction, interaction, cfg, guildId, client, 'goodbye');
                            break;
                    }
                } catch (error) {
                    logger.error('Unexpected greet dashboard error:', error);
                    const errorMessage = error instanceof TitanBotError ? error.userMessage : 'An error occurred updating the configuration.';
                    
                    await selectInteraction.followUp({
                        embeds: [errorEmbed('Configuration Error', errorMessage)],
                        flags: MessageFlags.Ephemeral,
                    }).catch(() => {});
                }
            });

            // ── Button collector for toggles ──────────────────────────────────
            const btnCollector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i => i.user.id === interaction.user.id && i.customId.startsWith('greet_cfg_'),
                time: 600_000,
            });

            btnCollector.on('collect', async btnInteraction => {
                try {
                    await btnInteraction.deferUpdate().catch(() => null);
                } catch (err) {
                    return;
                }
                const customId = btnInteraction.customId;

                if (customId === `greet_cfg_toggle_welcome_${guildId}`) {
                    cfg.enabled = !cfg.enabled;
                } else if (customId === `greet_cfg_toggle_goodbye_${guildId}`) {
                    cfg.goodbyeEnabled = !cfg.goodbyeEnabled;
                } else if (customId === `greet_cfg_ping_welcome_${guildId}`) {
                    cfg.welcomePing = !cfg.welcomePing;
                } else if (customId === `greet_cfg_ping_goodbye_${guildId}`) {
                    cfg.goodbyePing = !cfg.goodbyePing;
                }

                await saveWelcomeConfig(client, guildId, cfg);
                await refreshDashboard(interaction, cfg, guildId);
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    btnCollector.stop();
                    try {
                        await InteractionHelper.safeEditReply(interaction, {
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle('⏰ Dashboard Timed Out')
                                    .setDescription('This dashboard has been closed due to inactivity.')
                                    .setColor(getColor('error'))
                            ],
                            components: [],
                            flags: MessageFlags.Ephemeral,
                        });
                    } catch (error) {
                        logger.debug('Could not close dashboard on timeout:', error.message);
                    }
                }
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw new TitanBotError(`Greet dashboard failed: ${error.message}`, ErrorTypes.UNKNOWN, 'Failed to open the greet dashboard.');
        }
    },
};

// ─── Channel Handlers ─────────────────────────────────────────────────────────

async function handleWelcomeChannel(selectInteraction, rootInteraction, cfg, guildId, client) {
    await selectInteraction.deferUpdate().catch(() => {});

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('greet_cfg_welcome_channel')
        .setPlaceholder('Select a text channel...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('🟢 Welcome Channel')
                .setDescription(`**Current:** ${cfg.channelId ? `<#${cfg.channelId}>` : '`Not set`'}\n\nSelect the channel for welcome messages.`)
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'greet_cfg_welcome_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        await chanInteraction.deferUpdate().catch(() => {});
        const channel = chanInteraction.channels.first();

        if (!botHasPermission(channel, ['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
            return void await chanInteraction.followUp({
                embeds: [errorEmbed('Missing Permissions', `I need permissions in ${channel}.`)],
                flags: MessageFlags.Ephemeral,
            });
        }

        cfg.channelId = channel.id;
        await saveWelcomeConfig(client, guildId, cfg);
        await refreshDashboard(rootInteraction, cfg, guildId);
    });
}

async function handleGoodbyeChannel(selectInteraction, rootInteraction, cfg, guildId, client) {
    await selectInteraction.deferUpdate().catch(() => {});

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('greet_cfg_goodbye_channel')
        .setPlaceholder('Select a text channel...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('🔴 Goodbye Channel')
                .setDescription(`**Current:** ${cfg.goodbyeChannelId ? `<#${cfg.goodbyeChannelId}>` : '`Not set`'}\n\nSelect the channel for goodbye messages.`)
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const chanCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'greet_cfg_goodbye_channel',
        time: 60_000,
        max: 1,
    });

    chanCollector.on('collect', async chanInteraction => {
        await chanInteraction.deferUpdate().catch(() => {});
        const channel = chanInteraction.channels.first();

        if (!botHasPermission(channel, ['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
            return void await chanInteraction.followUp({
                embeds: [errorEmbed('Missing Permissions', `I need permissions in ${channel}.`)],
                flags: MessageFlags.Ephemeral,
            });
        }

        cfg.goodbyeChannelId = channel.id;
        await saveWelcomeConfig(client, guildId, cfg);
        await refreshDashboard(rootInteraction, cfg, guildId);
    });
}

// ─── Message Handlers ─────────────────────────────────────────────────────────

async function handleWelcomeMessage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_welcome_message')
        .setTitle('Edit Welcome Message')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('message_input')
                    .setLabel('Message (variables: {user}, {server})')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(cfg.welcomeMessage || 'Welcome {user} to {server}!')
                    .setMaxLength(2000)
                    .setRequired(true),
            ),
        );

    await selectInteraction.showModal(modal).catch(() => {});

    const submitted = await selectInteraction.awaitModalSubmit({
        filter: i => i.customId === 'greet_cfg_welcome_message' && i.user.id === selectInteraction.user.id,
        time: 120_000,
    }).catch(() => null);

    if (!submitted) return;
    await submitted.deferUpdate().catch(() => {});

    cfg.welcomeMessage = submitted.fields.getTextInputValue('message_input').trim();
    await saveWelcomeConfig(client, guildId, cfg);
    await refreshDashboard(rootInteraction, cfg, guildId);
}

async function handleGoodbyeMessage(selectInteraction, rootInteraction, cfg, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('greet_cfg_goodbye_message')
        .setTitle('Edit Goodbye Message')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('message_input')
                    .setLabel('Message (variables: {user}, {server})')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(cfg.leaveMessage || '{user.tag} has left the server.')
                    .setMaxLength(2000)
                    .setRequired(true),
            ),
        );

    await selectInteraction.showModal(modal).catch(() => {});

    const submitted = await selectInteraction.awaitModalSubmit({
        filter: i => i.customId === 'greet_cfg_goodbye_message' && i.user.id === selectInteraction.user.id,
        time: 120_000,
    }).catch(() => null);

    if (!submitted) return;
    await submitted.deferUpdate().catch(() => {});

    cfg.leaveMessage = submitted.fields.getTextInputValue('message_input').trim();
    await saveWelcomeConfig(client, guildId, cfg);
    await refreshDashboard(rootInteraction, cfg, guildId);
}

// ─── Consolidated Image URL Handler ──────────────────────────────────────────

async function handleImageModal(selectInteraction, rootInteraction, cfg, guildId, client, type) {
    const isWelcome = type === 'welcome';
    const currentUrl = isWelcome 
        ? (cfg.welcomeImage || '') 
        : (typeof cfg.leaveEmbed?.image === 'string' ? cfg.leaveEmbed.image : cfg.leaveEmbed?.image?.url || '');

    const modal = new ModalBuilder()
        .setCustomId(`greet_cfg_${type}_image`)
        .setTitle(`Set ${isWelcome ? 'Welcome' : 'Goodbye'} Image URL`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('image_input')
                    .setLabel('Direct Image URL (Leave blank to remove)')
                    .setPlaceholder('https://example.com/image.png')
                    .setStyle(TextInputStyle.Short)
                    .setValue(currentUrl)
                    .setRequired(false)
            )
        );

    await selectInteraction.showModal(modal).catch(() => {});

    const submitted = await selectInteraction.awaitModalSubmit({
        filter: i => i.customId === `greet_cfg_${type}_image` && i.user.id === selectInteraction.user.id,
        time: 120_000,
    }).catch(() => null);

    if (!submitted) return;

    let imageUrl = submitted.fields.getTextInputValue('image_input').trim();

    if (imageUrl) {
        try {
            const parsed = new URL(imageUrl);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        } catch {
            return void await submitted.reply({
                embeds: [errorEmbed('Invalid URL', 'Please provide a valid URL starting with `http://` or `https://`.')],
                flags: MessageFlags.Ephemeral,
            }).catch(() => {});
        }
    }

    await submitted.deferUpdate().catch(() => {});

    if (isWelcome) {
        cfg.welcomeImage = imageUrl || null;
    } else {
        const nextLeaveEmbed = { ...(cfg.leaveEmbed || {}) };
        if (imageUrl) nextLeaveEmbed.image = imageUrl;
        else delete nextLeaveEmbed.image;
        cfg.leaveEmbed = nextLeaveEmbed;
    }

    await saveWelcomeConfig(client, guildId, cfg);
    await refreshDashboard(rootInteraction, cfg, guildId);
}
