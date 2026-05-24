import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';

import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Verwaltet das Ticket-System des Servers.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription(
                    "Richtet das Ticket-Erstellungs-Panel in einem bestimmten Kanal ein.",
                )
                .addChannelOption((option) =>
                    option
                        .setName("panel_channel")
                        .setDescription(
                            "Der Kanal, in dem das Ticket-Panel gesendet wird.",
                        )
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("panel_message")
                        .setDescription(
                            "Die Hauptnachricht/Beschreibung für das Ticket-Panel.",
                        )
                        .setRequired(true),
                )
                .addStringOption((option) =>
                    option
                        .setName("button_label")
                        .setDescription(
                            "Beschriftung des Ticket-Buttons (Standard: Ticket erstellen)",
                        )
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName("category")
                        .setDescription(
                            "Die Kategorie, in der neue Tickets erstellt werden (optional).",
                        )
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addChannelOption((option) =>
                    option
                        .setName("closed_category")
                        .setDescription(
                            "Die Kategorie, in die geschlossene Tickets verschoben werden (optional).",
                        )
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false),
                )
                .addRoleOption((option) =>
                    option
                        .setName("staff_role")
                        .setDescription(
                            "Die Team-Rolle, die Zugriff auf die Tickets hat (optional).",
                        )
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName("max_tickets_per_user")
                        .setDescription("Maximale Anzahl an Tickets, die ein User gleichzeitig öffnen kann (Standard: 3)")
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName("dm_on_close")
                        .setDescription("Sendet dem User eine DM, wenn sein Ticket geschlossen wird (Standard: true)")
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setDescription("Öffnet das interaktive Ticket-System-Dashboard"),
        ),
    category: "ticket",

    async execute(interaction, config, client) {
        try {
            
            const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
            if (!deferred) {
                return;
            }

            if (
                !interaction.member.permissions.has(
                    PermissionFlagsBits.ManageChannels,
                )
            ) {
                logger.warn('Ticket-Befehl Berechtigung verweigert', {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'ticket'
                });
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            "Zugriff verweigert",
                            "Du benötigst die Berechtigung `Kanäle verwalten` für diese Aktion.",
                        ),
                    ],
                });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === "dashboard") {
                return ticketConfig.execute(interaction, config, client);
            }

            if (subcommand === "setup") {
                const existingConfig = await getGuildConfig(client, interaction.guildId);
                if (existingConfig?.ticketPanelChannelId) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            errorEmbed(
                                'Ticket-System bereits aktiv',
                                `Auf diesem Server ist bereits ein Ticket-System eingerichtet (Panel in <#${existingConfig.ticketPanelChannelId}>).\n\nEs wird nur ein Ticket-System pro Server unterstützt. Nutze \`/ticket dashboard\`, um das bestehende Setup zu bearbeiten, oder wähle dort **System löschen**, um es zu entfernen und neu zu starten.`,
                            ),
                        ],
                    });
                }

                const panelChannel = interaction.options.getChannel("panel_channel");
                const categoryChannel = interaction.options.getChannel("category");
                const closedCategoryChannel = interaction.options.getChannel("closed_category");
                const staffRole = interaction.options.getRole("staff_role");
                const panelMessage = interaction.options.getString("panel_message") || "Klicke auf den Button unten, um ein Support-Ticket zu erstellen.";
                const buttonLabel = interaction.options.getString("button_label") || "Ticket erstellen";
                const maxTicketsPerUser = interaction.options.getInteger("max_tickets_per_user") || 3;
                const dmOnClose = interaction.options.getBoolean("dm_on_close") !== false;

                const setupEmbed = createEmbed({ 
                    title: "🎫 Support-Tickets", 
                    description: panelMessage,
                    color: getColor('info')
                });

                const ticketButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("create_ticket")
                        .setLabel(buttonLabel)
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji("📩"),
                );

                try {
                    await panelChannel.send({
                        embeds: [setupEmbed],
                        components: [ticketButton],
                    });

                    if (client.db && interaction.guildId) {
                        const currentConfig = existingConfig || {};
                        currentConfig.ticketCategoryId = categoryChannel ? categoryChannel.id : null;
                        currentConfig.ticketClosedCategoryId = closedCategoryChannel ? closedCategoryChannel.id : null;
                        currentConfig.ticketStaffRoleId = staffRole ? staffRole.id : null;
                        currentConfig.ticketPanelChannelId = panelChannel.id;
                        currentConfig.ticketPanelMessage = panelMessage;
                        currentConfig.ticketButtonLabel = buttonLabel;
                        currentConfig.maxTicketsPerUser = maxTicketsPerUser;
                        currentConfig.dmOnClose = dmOnClose;

                        const { getGuildConfigKey } = await import('../../utils/database.js');
                        const configKey = getGuildConfigKey(interaction.guildId);
                        await client.db.set(configKey, currentConfig);
                        
                        logger.info('Ticket-Konfiguration gespeichert', {
                            guildId: interaction.guildId,
                            categoryId: categoryChannel?.id,
                            closedCategoryId: closedCategoryChannel?.id,
                            staffRoleId: staffRole?.id,
                            maxTickets: maxTicketsPerUser,
                            dmOnClose: dmOnClose
                        });
                    }

                    let successMessage = `Das Ticket-Erstellungs-Panel wurde erfolgreich in ${panelChannel} gesendet. `;
                    
                    if (categoryChannel) {
                        successMessage += `Neue Tickets werden in der Kategorie **${categoryChannel.name}** erstellt. `;
                    } else {
                        successMessage += 'Neue Tickets werden in einer neuen Kategorie namens "Tickets" erstellt. ';
                    }
                    
                    if (closedCategoryChannel) {
                        successMessage += `Geschlossene Tickets werden in die Kategorie **${closedCategoryChannel.name}** verschoben. `;
                    }
                    
                    if (staffRole) {
                        successMessage += `Die Rolle **${staffRole.name}** erhält Zugriff auf die Tickets. `;
                    }
                    
                    successMessage += `\n\n**Max. Tickets pro User:** ${maxTicketsPerUser}\n**DM beim Schließen:** ${dmOnClose ? 'Aktiviert' : 'Deaktiviert'}`;

                    await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            successEmbed(
                                "Ticket-Panel eingerichtet",
                                successMessage,
                            ),
                        ],
                    });

                    logger.info('Ticket-Panel-Setup abgeschlossen', {
                        userId: interaction.user.id,
                        userTag: interaction.user.tag,
                        guildId: interaction.guildId,
                        panelChannelId: panelChannel.id,
                        categoryId: categoryChannel?.id,
                        closedCategoryId: closedCategoryChannel?.id,
                        staffRoleId: staffRole?.id,
                        maxTickets: maxTicketsPerUser,
                        dmOnClose: dmOnClose,
                        commandName: 'ticket_setup'
                    });

                    // Hinweis: Das logEmbed wird hier vorbereitet, sollte aber vermutlich an einen Log-Kanal gesendet werden, falls implementiert.
                    const logEmbed = createEmbed({
                        title: "🔧 Ticket-System Setup (Konfigurations-Log)",
                        description: `Das Ticket-Panel wurde in ${panelChannel} von ${interaction.user} eingerichtet.`,
                        color: getColor('warning')
                    })
                    .addFields(
                        {
                            name: "Panel-Kanal",
                            value: panelChannel.toString(),
                            inline: true,
                        },
                        {
                            name: "Ticket-Kategorie",
                            value: categoryChannel
                                ? categoryChannel.toString()
                                : "Keine angegeben.",
                            inline: true,
                        },
                        {
                            name: "Kategorie für Geschlossene",
                            value: closedCategoryChannel
                                ? closedCategoryChannel.toString()
                                : "Keine angegeben.",
                            inline: true,
                        },
                        {
                            name: "Team-Rolle",
                            value: staffRole
                                ? staffRole.toString()
                                : "Keine angegeben.",
                            inline: true,
                        },
                        {
                            name: "Max. Tickets pro User",
                            value: maxTicketsPerUser.toString(),
                            inline: true,
                        },
                        {
                            name: "DM beim Schließen",
                            value: dmOnClose ? 'Aktiviert' : 'Deaktiviert',
                            inline: true,
                        },
                        {
                            name: "Moderator",
                            value: `${interaction.user.tag} (${interaction.user.id})`,
                            inline: false,
                        },
                    );

                } catch (error) {
                    logger.error('Fehler beim Ticket-Setup', {
                        error: error.message,
                        stack: error.stack,
                        userId: interaction.user.id,
                        guildId: interaction.guildId,
                        commandName: 'ticket_setup'
                    });
                    if (interaction.deferred || interaction.replied) {
                        await InteractionHelper.safeEditReply(interaction, {
                            embeds: [
                                errorEmbed(
                                    "Setup fehlgeschlagen",
                                    "Das Ticket-Panel konnte nicht gesendet oder die Konfiguration nicht gespeichert werden. Bitte überprüfe die Berechtigungen des Bots (insbesondere das Senden von Nachrichten im Zielkanal) und die Datenbankverbindung.",
                                ),
                            ],
                        }).catch(err => {
                            logger.error('Fehler beim Senden der Fehlerantwort', {
                                error: err.message,
                                guildId: interaction.guildId
                            });
                        });
                    } else {
                        await handleInteractionError(interaction, error, {
                            commandName: 'ticket_setup',
                            source: 'ticket_setup_command'
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Fehler beim Ausführen des Ticket-Befehls', {
                error: error.message,
                stack: error.stack,
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ticket'
            });
            await handleInteractionError(interaction, error, {
                commandName: 'ticket',
                source: 'ticket_command_main'
            });
        }
    }
};



