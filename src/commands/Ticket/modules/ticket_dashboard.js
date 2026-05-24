import { getColor } from '../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    UserSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { getGuildConfigKey } from '../../utils/database.js';
import { getUserTicketCount } from '../../services/ticket.js';

// ─── Embed & Menu Builders ────────────────────────────────────────────────────

function buildDashboardEmbed(config, guild) {
    const panelChannel = config.ticketPanelChannelId ? `<#${config.ticketPanelChannelId}>` : '`Nicht gesetzt`';
    const staffRole = config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : '`Nicht gesetzt`';
    const ticketLogsChannel = config.ticketLogsChannelId ? `<#${config.ticketLogsChannelId}>` : '`Nicht gesetzt`';
    const transcriptChannel = config.ticketTranscriptChannelId ? `<#${config.ticketTranscriptChannelId}>` : '`Nicht gesetzt`';
    
    // Kategorie-Namen vom Server abrufen
    const openCategoryChannel = config.ticketCategoryId ? guild.channels.cache.get(config.ticketCategoryId) : null;
    const openCategory = openCategoryChannel ? openCategoryChannel.toString() : '`Nicht gesetzt`';
    
    const closedCategoryChannel = config.ticketClosedCategoryId ? guild.channels.cache.get(config.ticketClosedCategoryId) : null;
    const closedCategory = closedCategoryChannel ? closedCategoryChannel.toString() : '`Nicht gesetzt`';

    const rawMsg = config.ticketPanelMessage || 'Klicke auf die Schaltfläche unten, um ein Support-Ticket zu erstellen.';
    const panelMsg = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;
    const btnLabel = `\`${config.ticketButtonLabel || 'Ticket erstellen'}\``;

    return new EmbedBuilder()
        .setTitle('🎫 Ticket-System Dashboard')
        .setDescription(`Verwalte die Einstellungen des Ticket-Systems für **${guild.name}**.\nWähle unten eine Option aus, um eine Einstellung zu ändern.`)
        .setColor(getColor('info'))
        .addFields(
            { name: '📢 Panel-Kanal', value: panelChannel, inline: true },
            { name: '🛡️ Team-Rolle', value: staffRole, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '📁 Kategorie (Offene Tickets)', value: openCategory, inline: true },
            { name: '📂 Kategorie (Geschlossene Tickets)', value: closedCategory, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '📝 Panel-Nachricht', value: panelMsg, inline: false },
            { name: '🏷️ Button-Beschriftung', value: btnLabel, inline: true },
            { name: '🔢 Max. Tickets/User', value: String(config.maxTicketsPerUser || 3), inline: true },
            { name: '📬 DM bei Schließung', value: config.dmOnClose !== false ? '✅ Aktiviert' : '❌ Deaktiviert', inline: true },
            { name: '🎫 Ticket-Log-Kanal', value: ticketLogsChannel, inline: true },
            { name: '📜 Transcript-Kanal', value: transcriptChannel, inline: true },
        )
        .setFooter({ text: 'Wähle unten eine Option • Dashboard schließt nach 10 Minuten Inaktivität' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`ticket_config_${guildId}`)
        .setPlaceholder('Wähle eine Einstellung zum Konfigurieren...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Panel-Nachricht bearbeiten')
                .setDescription('Ändere den Text, der auf dem Ticket-Erstellungs-Panel angezeigt wird')
                .setValue('panel_message')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Button-Beschriftung bearbeiten')
                .setDescription('Ändere den Text auf dem "Ticket erstellen"-Button')
                .setValue('button_label')
                .setEmoji('🏷️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Kategorie für offene Tickets ändern')
                .setDescription('Kategorie, in der neue Tickets erstellt werden')
                .setValue('open_category')
                .setEmoji('📁'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Kategorie für geschlossene Tickets ändern')
                .setDescription('Kategorie, in die geschlossene Tickets verschoben werden')
                .setValue('closed_category')
                .setEmoji('📂'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Max. Tickets pro Benutzer festlegen')
                .setDescription('Limitiert, wie viele offene Tickets ein Benutzer gleichzeitig haben darf')
                .setValue('max_tickets')
                .setEmoji('🔢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ticket-Log-Kanal festlegen')
                .setDescription('Kanal für Ticket-Feedback, Lifecycle-Events und Logs')
                .setValue('logs_channel')
                .setEmoji('🎫'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Transcript-Kanal festlegen')
                .setDescription('Kanal für automatisch generierte Transcripts nach dem Löschen')
                .setValue('transcript_channel')
                .setEmoji('📜'),
        );
}

function buildButtonRow(guildConfig, guildId, disabled = false) {
    const dmEnabled = guildConfig.dmOnClose !== false;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_dm_toggle_${guildId}`)
            .setLabel('DM bei Schließung')
            .setStyle(dmEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji(dmEnabled ? '📬' : '📭')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_staff_role_btn_${guildId}`)
            .setLabel('Team-Rolle')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🛡️')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_delete_${guildId}`)
            .setLabel('System löschen')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
            .setDisabled(disabled),
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function refreshDashboard(rootInteraction, guildConfig, guildId) {
    const buttonRow = buildButtonRow(guildConfig, guildId);
    const selectRow = new ActionRowBuilder().addComponents(buildSelectMenu(guildId));
    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [buildDashboardEmbed(guildConfig, rootInteraction.guild)],
        components: [buttonRow, selectRow],
    }).catch(() => {});
}

/**
 * Versucht, die Live-Ticket-Panel-Nachricht im Panel-Kanal zu finden und zu bearbeiten.
 * Gibt true zurück, wenn das Panel gefunden und aktualisiert wurde, andernfalls false.
 */
async function updateLivePanel(client, guild, config) {
    if (!config.ticketPanelChannelId) return false;
    try {
        const channel = await guild.channels.fetch(config.ticketPanelChannelId).catch(() => null);
        if (!channel) return false;

        const messages = await channel.messages.fetch({ limit: 50 });
        const panelMsg = messages.find(
            m =>
                m.author.id === client.user.id &&
                m.components?.length > 0 &&
                m.components[0]?.components?.[0]?.customId === 'create_ticket',
        );
        if (!panelMsg) return false;

        const updatedEmbed = new EmbedBuilder()
            .setTitle('🎫 Support-Tickets')
            .setDescription(config.ticketPanelMessage || 'Klicke auf die Schaltfläche unten, um ein Support-Ticket zu erstellen.')
            .setColor(getColor('info'));

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel(config.ticketButtonLabel || 'Ticket erstellen')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📩'),
        );

        await panelMsg.edit({ embeds: [updatedEmbed], components: [button] });
        return true;
    } catch (error) {
        logger.warn('Live-Ticket-Panel konnte nicht aktualisiert werden:', error.message);
        return false;
    }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default {
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const guildConfig = await getGuildConfig(client, guildId);

            if (!guildConfig.ticketPanelChannelId) {
                throw new TitanBotError(
                    'Ticket-System nicht konfiguriert',
                    ErrorTypes.CONFIGURATION,
                    'Das Ticket-System wurde noch nicht eingerichtet. Führe zuerst `/ticket setup` aus, um es zu konfigurieren.',
                );
            }

            const selectMenu = buildSelectMenu(guildId);
            const selectRow = new ActionRowBuilder().addComponents(selectMenu);
            const buttonRow = buildButtonRow(guildConfig, guildId);

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [buildDashboardEmbed(guildConfig, interaction.guild)],
                components: [buttonRow, selectRow],
            });

            const replyMessage = await interaction.fetchReply().catch(() => null);
            const replyMessageId = replyMessage?.id;

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: i =>
                    i.user.id === interaction.user.id &&
                    i.customId === `ticket_config_${guildId}` &&
                    (!replyMessageId || i.message.id === replyMessageId),
                time: 600_000,
            });

            const buttonCollector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter: i =>
                    i.user.id === interaction.user.id &&
                    (!replyMessageId || i.message.id === replyMessageId) &&
                    (i.customId === `ticket_cfg_dm_toggle_${guildId}` ||
                        i.customId === `ticket_cfg_staff_role_btn_${guildId}` ||
                        i.customId === `ticket_cfg_delete_${guildId}`),

                time: 600_000,
            });

            collector.on('collect', async (selectInteraction) => {
                const selectedOption = selectInteraction.values[0];
                try {
                    switch (selectedOption) {
                        case 'panel_message':
                            await handlePanelMessage(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'button_label':
                            await handleButtonLabel(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'staff_role':
                            await handleStaffRole(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'open_category':
                            await handleOpenCategory(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'closed_category':
                            await handleClosedCategory(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'max_tickets':
                            await handleMaxTickets(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'logs_channel':
                            await handleLogsChannel(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'transcript_channel':
                            await handleTranscriptChannel(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                    }
                } catch (error) {
                    if (error instanceof TitanBotError) {
                        logger.debug(`Validierungsfehler bei der Ticket-Konfiguration: ${error.message}`);
                    } else {
                        logger.error('Unerwarteter Fehler im Ticket-Konfigurationsmenü:', error);
                    }

                    const errorMessage =
                        error instanceof TitanBotError
                            ? error.userMessage || 'Beim Verarbeiten deiner Auswahl ist ein Fehler aufgetreten.'
                            : 'Ein unerwarteter Fehler ist beim Aktualisieren der Konfiguration aufgetreten.';

                    await selectInteraction
                        .followUp({
                            embeds: [errorEmbed('Konfigurationsfehler', errorMessage)],
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                }
            });

            buttonCollector.on('collect', async (btnInteraction) => {
                try {
                    if (btnInteraction.customId === `ticket_cfg_dm_toggle_${guildId}`) {
                        await handleDmOnClose(btnInteraction, interaction, guildConfig, guildId, client);
                    } else if (btnInteraction.customId === `ticket_cfg_staff_role_btn_${guildId}`) {
                        await handleStaffRole(btnInteraction, interaction, guildConfig, guildId, client);
                    } else if (btnInteraction.customId === `ticket_cfg_delete_${guildId}`) {
                        await handleDeleteSystem(btnInteraction, interaction, guildConfig, guildId, client);
                    }
                } catch (error) {
                    if (error.code === 40060) return;
                    if (error instanceof TitanBotError) {
                        logger.debug(`Fehler bei Ticket-Konfigurations-Button: ${error.message}`);
                    } else {
                        logger.error('Unerwarteter Fehler bei Ticket-Konfigurations-Button:', error);
                    }
                    const errorMessage =
                        error instanceof TitanBotError
                            ? error.userMessage || 'Beim Verarbeiten deiner Auswahl ist ein Fehler aufgetreten.'
                            : 'Ein unerwarteter Fehler ist beim Aktualisieren der Konfiguration aufgetreten.';
                    
                    await btnInteraction
                        .followUp({
                            embeds: [errorEmbed('Konfigurationsfehler', errorMessage)],
                            flags: MessageFlags.Ephemeral,
                        })
                        .catch(() => {});
                }
            });

            collector.on('end', async (collected, reason) => {
                buttonCollector.stop();
                if (reason === 'time') {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('⏰ Dashboard-Zeitüberschreitung')
                        .setDescription('Dieses Dashboard wurde wegen Inaktivität geschlossen. Bitte führe den Befehl erneut aus, um fortzufahren.')
                        .setColor(getColor('error'));
                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [timeoutEmbed],
                        components: [],
                    }).catch(() => {});
                }
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unerwarteter Fehler in ticket_config:', error);
            throw new TitanBotError(
                `Ticket-Konfiguration fehlgeschlagen: ${error.message}`,
                ErrorTypes.UNKNOWN,
                'Das Ticket-Konfigurations-Dashboard konnte nicht geöffnet werden.',
            );
        }
    },
};

// ─── Panel Message ────────────────────────────────────────────────────────────

async function handlePanelMessage(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_cfg_panel_msg')
        .setTitle('Panel-Nachricht bearbeiten')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('panel_msg_input')
                    .setLabel('Panel-Nachricht')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(
                        guildConfig.ticketPanelMessage ||
                            'Klicke auf die Schaltfläche unten, um ein Support-Ticket zu erstellen.',
                    )
                    .setMaxLength(2000)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('Klicke auf die Schaltfläche unten, um ein Support-Ticket zu erstellen.'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'ticket_cfg_panel_msg' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newMessage = submitted.fields.getTextInputValue('panel_msg_input').trim();
    guildConfig.ticketPanelMessage = newMessage;
    await client.db.set(getGuildConfigKey(guildId), guildConfig);

    const panelUpdated = await updateLivePanel(client, rootInteraction.guild, guildConfig);

    await submitted.reply({
        embeds: [
            successEmbed(
                '✅ Panel-Nachricht aktualisiert',
                `Die Panel-Nachricht wurde erfolgreich aktualisiert.${
                    panelUpdated
                        ? '\nDas Live-Ticket-Panel wurde ebenfalls aktualisiert.'
                        : '\n> **Hinweis:** Das Live-Panel konnte nicht gefunden werden. Die neue Nachricht wird angewendet, sobald du das nächste Mal \`/ticket setup\` ausführst.'
                }`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId);
}

// ─── Button Label ─────────────────────────────────────────────────────────────

async function handleButtonLabel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_cfg_btn_label')
        .setTitle('Button-Beschriftung bearbeiten')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('btn_label_input')
                    .setLabel('Button-Beschriftung (max. 80 Zeichen)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(guildConfig.ticketButtonLabel || 'Ticket erstellen')
                    .setMaxLength(80)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('Ticket erstellen'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'ticket_cfg_btn_label' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newLabel = submitted.fields.getTextInputValue('btn_label_input').trim();
    guildConfig.ticketButtonLabel = newLabel;
    await client.db.set(getGuildConfigKey(guildId), guildConfig);

    const panelUpdated = await updateLivePanel(client, rootInteraction.guild, guildConfig);

    await submitted.reply({
        embeds: [
            successEmbed(
                '✅ Button-Beschriftung aktualisiert',
                `Die Button-Beschriftung wurde in \`${newLabel}\` geändert.${
                    panelUpdated
                        ? '\nDer Button auf dem Live-Ticket-Panel wurde ebenfalls aktualisiert.'
                        : '\n> **Hinweis:** Das Live-Panel konnte nicht gefunden werden. Die neue Beschriftung wird angewendet, sobald du das nächste Mal \`/ticket setup\` ausführst.'
                }`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId);
}

// ─── Team Rolle ───────────────────────────────────────────────────────────────

async function handleStaffRole(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('ticket_cfg_staff_role')
        .setPlaceholder('Wähle die Team-Rolle aus...')
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(roleSelect);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('🛡️ Team-Rolle ändern')
                .setDescription(
                    `**Aktuell:** ${guildConfig.ticketStaffRoleId ? `<@&${guildConfig.ticketStaffRoleId}>` : '`Nicht gesetzt`'}\n\nWähle die Rolle aus, die Zugriff auf die Verwaltung von Tickets erhalten soll.`,
                )
                .setColor(getColor('info')),
        ],
        components: [row],
        flags: MessageFlags.Ephemeral,
    });

    const roleCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.RoleSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_staff_role',
        time: 60_000,
        max: 1,
    });

    roleCollector.on('collect', async roleInteraction => {
        await roleInteraction.deferUpdate();
        const role = roleInteraction.roles.first();

        guildConfig.ticketStaffRoleId = role.id;
        await client.db.set(getGuildConfigKey(guildId), guildConfig);

        await roleInteraction.followUp({
            embeds: [successEmbed('✅ Team-Rolle aktualisiert', `Die Team-Rolle wurde auf ${role} gesetzt.`)],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId);
    });

    roleCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction
                .followUp({
                    embeds: [errorEmbed('Zeitüberschreitung', 'Es wurde keine Rolle ausgewählt. Die Team-Rolle wurde nicht geändert.')],
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    });
}

// ─── Open Tickets Category ────────────────────────────────────────────────────

async function handleOpenCategory(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_open_cat')
        .setPlaceholder('Wähle eine Kategorie...')
        .addChannelTypes(ChannelType.GuildCategory)
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('📁 Kategorie für offene Tickets ändern')
                .setDescription(
                    `**Aktuell:** ${guildConfig.ticketCategoryId ? `<#${guildConfig.ticketCategoryId}>` : '`Nicht gesetzt`'}\n\nWähle die Kategorie aus, in der neue Tickets erstellt werden sollen.`,
                )
                .setColor(getColor('info')),
        ],
        components: [row],
        flags: MessageFlags.Ephemeral,
    });

    const catCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_open_cat',
        time: 60_000,
        max: 1,
    });

    catCollector.on('collect', async catInteraction => {
        await catInteraction.deferUpdate();
        const category = catInteraction.channels.first();

        guildConfig.ticketCategoryId = category.id;
        await client.db.set(getGuildConfigKey(guildId), guildConfig);

        await catInteraction.followUp({
            embeds: [
                successEmbed(
                    '✅ Offene Kategorie aktualisiert',
                    `Neue Tickets werden ab jetzt in der Kategorie **${category.name}** erstellt.`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId);
    });

    catCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction
                .followUp({
                    embeds: [
                        errorEmbed('Zeitüberschreitung', 'Es wurde keine Kategorie ausgewählt. Die Einstellung wurde nicht geändert.'),
                    ],
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    });
}

// ─── Closed Tickets Category ──────────────────────────────────────────────────

async function handleClosedCategory(
    selectInteraction,
    rootInteraction,
    guildConfig,
    guildId,
    client,
) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_closed_cat')
        .setPlaceholder('Wähle eine Kategorie...')
        .addChannelTypes(ChannelType.GuildCategory)
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('📂 Kategorie für geschlossene Tickets ändern')
                .setDescription(
                    `**Aktuell:** ${guildConfig.ticketClosedCategoryId ? `<#${guildConfig.ticketClosedCategoryId}>` : '`Nicht gesetzt`'}\n\nWähle die Kategorie aus, in die geschlossene Tickets verschoben werden sollen.`,
                )
                .setColor(getColor('info')),
        ],
        components: [row],
        flags: MessageFlags.Ephemeral,
    });

    const catCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_closed_cat',
        time: 60_000,
        max: 1,
    });

    catCollector.on('collect', async catInteraction => {
        await catInteraction.deferUpdate();
        const category = catInteraction.channels.first();

        guildConfig.ticketClosedCategoryId = category.id;
        await client.db.set(getGuildConfigKey(guildId), guildConfig);

        await catInteraction.followUp({
            embeds: [
                successEmbed(
                    '✅ Geschlossene Kategorie aktualisiert',
                    `Geschlossene Tickets werden ab jetzt in die Kategorie **${category.name}** verschoben.`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId);
    });

    catCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction
                .followUp({
                    embeds: [
                        errorEmbed('Zeitüberschreitung', 'Es wurde keine Kategorie ausgewählt. Die Einstellung wurde nicht geändert.'),
                    ],
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    });
}

// ─── Max Tickets per User ─────────────────────────────────────────────────────

async function handleMaxTickets(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_cfg_max_tickets')
        .setTitle('Max. Tickets pro Benutzer festlegen')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('max_tickets_input')
                    .setLabel('Max. offene Tickets (1–10)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(guildConfig.maxTicketsPerUser || 3))
                    .setMaxLength(2)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('3'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'ticket_cfg_max_tickets' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const raw = submitted.fields.getTextInputValue('max_tickets_input').trim();
    const newMax = parseInt(raw, 10);

    if (isNaN(newMax) || newMax < 1 || newMax > 10) {
        await submitted.reply({
            embeds: [errorEmbed('Ungültiger Wert', 'Die maximale Anzahl an Tickets muss eine ganze Zahl zwischen **1** und **10** sein.')],
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    guildConfig.maxTicketsPerUser = newMax;
    await client.db.set(getGuildConfigKey(guildId), guildConfig);

    await submitted.reply({
        embeds: [
            successEmbed(
                '✅ Ticket-Limit aktualisiert',
                `Benutzer können nun maximal **${newMax}** offene(s) Ticket(s) gleichzeitig haben.`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId);
}

// ─── DM on Close Toggle ───────────────────────────────────────────────────────

async function handleDmOnClose(btnInteraction, rootInteraction, guildConfig, guildId, client) {
    await btnInteraction.deferUpdate();

    const newState = guildConfig.dmOnClose === false;
    guildConfig.dmOnClose = newState;
    await client.db.set(getGuildConfigKey(guildId), guildConfig);

    await btnInteraction.followUp({
        embeds: [
            successEmbed(
                '✅ DM bei Schließung aktualisiert',
                `Benutzer erhalten **${newState ? 'ab jetzt' : 'nicht mehr'}** eine Direktnachricht (DM), wenn ihr Ticket geschlossen wird.`,
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId);
}

// ─── Feedback Logs Channel ────────────────────────────────────────────────────

async function handleLogsChannel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_logs_channel')
        .setPlaceholder('Wähle einen Kanal...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('🎫 Ticket-Log-Kanal auswählen')
                .setDescription('Wähle aus, wohin Ticket-Feedback, Lifecycle-Events (Öffnen, Schließen, Übernehmen etc.) und andere Logs gesendet werden sollen.')
                .setColor(getColor('info'))
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral
    });

    const collector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_logs_channel',
        time: 60_000,
        max: 1
    });

    collector.on('collect', async channelInteraction => {
        await channelInteraction.deferUpdate();
        const channel = channelInteraction.channels.first();

        guildConfig.ticketLogsChannelId = channel.id;
        await client.db.set(getGuildConfigKey(guildId), guildConfig);

        await channelInteraction.followUp({
            embeds: [successEmbed('✅ Log-Kanal aktualisiert', `Ticket-Logs werden ab jetzt an ${channel} gesendet.`)],
            flags: MessageFlags.Ephemeral
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId);
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction.followUp({
                embeds: [errorEmbed('Zeitüberschreitung', 'Kein Kanal ausgewählt. Es wurden keine Änderungen vorgenommen.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    });
}

// ─── Transcript Channel ───────────────────────────────────────────────────────

async function handleTranscriptChannel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_transcript_channel')
        .setPlaceholder('Wähle einen Kanal...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('📜 Transcript-Kanal auswählen')
                .setDescription('Wähle aus, wohin automatisch generierte Transcripts gesendet werden sollen, wenn ein Ticket gelöscht wird.')
                .setColor(getColor('info'))
        ],
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral
    });

    const collector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_transcript_channel',
        time: 60_000,
        max: 1
    });

    collector.on('collect', async channelInteraction => {
        await channelInteraction.deferUpdate();
        const channel = channelInteraction.channels.first();

        guildConfig.ticketTranscriptChannelId = channel.id;
        await client.db.set(getGuildConfigKey(guildId), guildConfig);

        await channelInteraction.followUp({
            embeds: [successEmbed('✅ Transcript-Kanal aktualisiert', `Transcripts werden ab jetzt an ${channel} gesendet.`)],
            flags: MessageFlags.Ephemeral
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId);
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction.followUp({
                embeds: [errorEmbed('Zeitüberschreitung', 'Kein Kanal ausgewählt. Es wurden keine Änderungen vorgenommen.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    });
}

// ─── Check User Tickets ───────────────────────────────────────────────────────

async function handleCheckUser(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('ticket_cfg_check_user')
        .setPlaceholder('Wähle einen Benutzer zum Überprüfen...')
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelect);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('🔍 Benutzer-Tickets prüfen')
                .setDescription('Wähle einen Benutzer aus, um dessen Anzahl an aktuell offenen Tickets einzusehen.')
                .setColor(getColor('info')),
        ],
        components: [row],
        flags: MessageFlags.Ephemeral,
    });

    const userCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.UserSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_check_user',
        time: 60_000,
        max: 1,
    });

    userCollector.on('collect', async userInteraction => {
        await userInteraction.deferUpdate();
        const targetUser = userInteraction.users.first();
        const maxTickets = guildConfig.maxTicketsPerUser || 3;
        const openCount = await getUserTicketCount(guildId, targetUser.id);
        const atLimit = openCount >= maxTickets;

        await userInteraction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`🎫 Ticket-Prüfung — ${targetUser.username}`)
                    .setDescription(
                        `**Offene Tickets:** ${openCount} / ${maxTickets}\n` +
                            `**Verbleibend:** ${Math.max(0, maxTickets - openCount)}\n\n` +
                            (atLimit
                                ? '⚠️ Dieser Benutzer hat sein Ticket-Limit erreicht.'
                                : '✅ Dieser Benutzer kann weitere Tickets öffnen.'),
                    )
                    .setColor(atLimit ? getColor('error') : getColor('success'))
                    .setThumbnail(targetUser.displayAvatarURL({ size: 64 }))
                    .setTimestamp(),
            ],
            flags: MessageFlags.Ephemeral,
        });
    });

    userCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            selectInteraction
                .followUp({
                    embeds: [errorEmbed('Zeitüberschreitung', 'Es wurde kein Benutzer ausgewählt.')],
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => {});
        }
    });
}

// ─── Delete Ticket System ─────────────────────────────────────────────────────

async function handleDeleteSystem(btnInteraction, rootInteraction, guildConfig, guildId, client) {
    const deleteModal = new ModalBuilder()
        .setCustomId('ticket_delete_confirm_modal')
        .setTitle('Ticket-System löschen')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('delete_confirmation')
                    .setLabel('Schreibe "DELETE" zum Bestätigen')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('DELETE')
                    .setMaxLength(6)
                    .setMinLength(6)
                    .setRequired(true)
            )
        );

    await btnInteraction.showModal(deleteModal);

    const submitted = await btnInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'ticket_delete_confirm_modal' && i.user.id === btnInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) {
        await refreshDashboard(rootInteraction, guildConfig, guildId);
        return;
    }

    const confirmation = submitted.fields.getTextInputValue('delete_confirmation').trim();

    if (confirmation !== 'DELETE') {
        await submitted.reply({
            embeds: [errorEmbed('Falsche Bestätigung', 'Du musst exakt "DELETE" eingeben, um das System zu löschen.')],
            flags: MessageFlags.Ephemeral,
        });
        await refreshDashboard(rootInteraction, guildConfig, guildId);
        return;
    }

    await submitted.deferUpdate();

    const keysToDelete = [
        'ticketPanelChannelId',
        'ticketPanelMessageId',
        'ticketStaffRoleId',
        'ticketCategoryId',
        'ticketClosedCategoryId',
        'ticketPanelMessage',
        'ticketButtonLabel',
        'maxTicketsPerUser',
        'dmOnClose',
    ];

    // Panel-Embed aus Discord löschen
    if (guildConfig.ticketPanelChannelId) {
        try {
            const panelChannel = await client.guilds.cache.get(guildId)?.channels.fetch(guildConfig.ticketPanelChannelId).catch(() => null);
            if (panelChannel) {
                if (guildConfig.ticketPanelMessageId) {
                    const panelMessage = await panelChannel.messages.fetch(guildConfig.ticketPanelMessageId).catch(() => null);
                    if (panelMessage) await panelMessage.delete().catch(() => {});
                } else {
                    // Fallback: Suche nach dem Panel anhand der Button-CustomId
                    const messages = await panelChannel.messages.fetch({ limit: 50 }).catch(() => null);
                    if (messages) {
                        const found = messages.find(
                            m => m.author.id === client.user.id &&
                                m.components?.[0]?.components?.[0]?.customId === 'create_ticket'
                        );
                        if (found) await found.delete().catch(() => {});
                    }
                }
            }
        } catch (panelDeleteError) {
            logger.warn('Ticket-Panel-Nachricht konnte nicht gelöscht werden:', panelDeleteError.message);
        }
    }

    // Alle offenen Ticket-Datensätze für diesen Server aus der Datenbank löschen
    try {
        const { pgConfig } = await import('../../../config/postgres.js');
        if (client.db?.db?.pool && typeof client.db.db.isAvailable === 'function' && client.db.db.isAvailable()) {
            await client.db.db.pool.query(
                `DELETE FROM ${pgConfig.tables.tickets} WHERE guild_id = $1`,
                [guildId]
            );
        }
    } catch (ticketDeleteError) {
        logger.warn('Ticket-Datensätze konnten nicht aus der Datenbank gelöscht werden:', ticketDeleteError.message);
    }

    for (const key of keysToDelete) {
        delete guildConfig[key];
    }
    await client.db.set(getGuildConfigKey(guildId), guildConfig);

    await submitted.followUp({
        embeds: [
            successEmbed(
                '✅ Ticket-System gelöscht',
                'Die gesamte Konfiguration des Ticket-Systems wurde zurückgesetzt. Führe `/ticket setup` aus, um es erneut einzurichten.',
            ),
        ],
        flags: MessageFlags.Ephemeral,
    });

    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [
            new EmbedBuilder()
                .setTitle('🗑️ Ticket-System gelöscht')
                .setDescription('Die Konfiguration des Ticket-Systems wurde vollständig gelöscht.')
                .setColor(getColor('error'))
                .setTimestamp(),
        ],
        components: [],
    }).catch(() => {});
}
