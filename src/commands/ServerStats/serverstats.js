import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { handleCreate } from './modules/serverstats_create.js';
import { handleList } from './modules/serverstats_list.js';
import { handleUpdate } from './modules/serverstats_update.js';
import { handleDelete } from './modules/serverstats_delete.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("serverstats")
        .setDescription("Verwalte Server-Statistiken, die Mitgliederzahlen und Kanaldaten erfassen")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName("create")
                .setDescription("Erstelle einen neuen Statistik-Tracker-Kanal in einer Kategorie")
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Der Typ der zu erfassenden Statistik")
                        .setRequired(true)
                        .addChoices(
                            { name: "Mitglieder + Bots", value: "members" },
                            { name: "Nur Mitglieder", value: "members_only" },
                            { name: "Nur Bots", value: "bots" }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("channel_type")
                        .setDescription("Der Kanaltyp, der für diesen Tracker erstellt werden soll")
                        .setRequired(true)
                        .addChoices(
                            { name: "Sprachkanal (empfohlen)", value: "voice" },
                            { name: "Textkanal", value: "text" }
                        )
                )
                .addChannelOption(option =>
                    option
                        .setName("category")
                        .setDescription("Die Kategorie, in der der Statistik-Kanal erstellt wird")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("Liste alle aktiven Statistik-Tracker für diesen Server auf")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("update")
                .setDescription("Aktualisiere die Einstellungen eines bestehenden Statistik-Trackers")
                .addStringOption(option =>
                    option
                        .setName("counter-id")
                        .setDescription("Die ID des Trackers, der aktualisiert werden soll")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("type")
                        .setDescription("Der neue Statistik-Typ")
                        .setRequired(false)
                        .addChoices(
                            { name: "Mitglieder + Bots", value: "members" },
                            { name: "Nur Mitglieder", value: "members_only" },
                            { name: "Nur Bots", value: "bots" }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("delete")
                .setDescription("Lösche einen bestehenden Statistik-Tracker")
                .addStringOption(option =>
                    option
                        .setName("counter-id")
                        .setDescription("Die ID des Trackers, der gelöscht werden soll")
                        .setRequired(true)
                )
        ),

    async execute(interaction, guildConfig, client) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case "create":
                    await handleCreate(interaction, client);
                    break;
                case "list":
                    await handleList(interaction, client);
                    break;
                case "update":
                    await handleUpdate(interaction, client);
                    break;
                case "delete":
                    await handleDelete(interaction, client);
                    break;
                default:
                    await InteractionHelper.safeReply(interaction, {
                        embeds: [errorEmbed("Unbekannter Unterbefehl.")],
                        flags: MessageFlags.Ephemeral
                    });
            }
        } catch (error) {
            logger.error(`Fehler bei Serverstats im Subcommand ${subcommand}:`, error);
            
            const errorEmbedMsg = createEmbed({ 
                title: "❌ Fehler", 
                description: "Beim Verarbeiten der Anfrage ist ein Fehler aufgetreten.",
                color: getColor('error')
            });

            if (!interaction.replied && !interaction.deferred) {
                await InteractionHelper.safeReply(interaction, { embeds: [errorEmbedMsg], flags: MessageFlags.Ephemeral }).catch(logger.error);
            } else {
                await interaction.followUp({ embeds: [errorEmbedMsg], flags: MessageFlags.Ephemeral }).catch(logger.error);
            }
        }
    }
};



