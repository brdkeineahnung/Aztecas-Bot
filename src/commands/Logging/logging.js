import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import dashboard from './modules/logging_dashboard.js';
import setchannel from './modules/logging_setchannel.js';
import filter from './modules/logging_filter.js';

export default {
    // Deutsche Registrierung des Hauptbefehls /logging und seiner Subcommands
    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Verwalte das Audit-Logging für diesen Server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Öffnet das interaktive Dashboard — Status einsehen und Kategorien umschalten.'),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setchannel')
                .setDescription('Legt den Log-Kanal für die Audit-Logs fest.')
                .addChannelOption((option) =>
                    option
                        .setName('kanal')
                        .setDescription('Der Textkanal, in den die Logs gesendet werden sollen.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false),
                )
                .addBooleanOption((option) =>
                    option
                        .setName('deaktivieren')
                        .setDescription('Auf "True" setzen, um das Audit-Logging komplett abzuschalten.')
                        .setRequired(false),
                ),
        )
        .addSubcommandGroup((group) =>
            group
                .setName('filter')
                .setDescription('Verwalte die Ignorierliste für das Logging (Benutzer und Kanäle überspringen).')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setDescription('Fügt einen Benutzer oder einen Kanal zur Ignorierliste hinzu.')
                        .addStringOption((option) =>
                            option
                                .setName('typ')
                                .setDescription('Wähle aus, ob ein Benutzer oder ein Kanal ignoriert werden soll.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Benutzer (User)', value: 'user' },
                                    { name: 'Kanal (Channel)', value: 'channel' },
                                ),
                        )
                        .addStringOption((option) =>
                            option
                                .setName('id')
                                .setDescription('Die Discord-ID des Benutzers oder Kanals.')
                                .setRequired(true),
                        ),
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setDescription('Entfernt einen Benutzer oder einen Kanal von der Ignorierliste.')
                        .addStringOption((option) =>
                            option
                                .setName('typ')
                                .setDescription('Wähle aus, ob es sich um einen Benutzer oder Kanal handelt.')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Benutzer (User)', value: 'user' },
                                    { name: 'Kanal (Channel)', value: 'channel' },
                                ),
                        )
                        .addStringOption((option) =>
                            option
                                .setName('id')
                                .setDescription('Die Discord-ID, die von der Liste entfernt werden soll.')
                                .setRequired(true),
                        ),
                ),
        ),

    async execute(interaction, config, client) {
        try {
            const subcommandGroup = interaction.options.getSubcommandGroup(false);
            const subcommand = interaction.options.getSubcommand();

            // Das Dashboard nutzt ein eigenes Defer-Handling, daher wird es direkt ausgeführt
            if (subcommand === 'dashboard') {
                return await dashboard.execute(interaction, config, client);
            }

            // setchannel und filter benötigen vorab ein sicheres Defer
            await InteractionHelper.safeDefer(interaction);

            // Zuordnung der Optionen an die Optionen-Namen im Builder angepasst
            if (subcommand === 'setchannel') {
                // Wir mappen die eingedeutschten Optionen intern für die Module um, falls nötig
                interaction.options.getChannelOriginal = interaction.options.getChannel;
                interaction.options.getChannel = (name) => interaction.options.getChannelOriginal(name === 'channel' ? 'kanal' : name);
                
                interaction.options.getBooleanOriginal = interaction.options.getBoolean;
                interaction.options.getBoolean = (name) => interaction.options.getBooleanOriginal(name === 'disable' ? 'deaktivieren' : name);

                return await setchannel.execute(interaction, config, client);
            }

            if (subcommandGroup === 'filter') {
                interaction.options.getStringOriginal = interaction.options.getString;
                interaction.options.getString = (name) => {
                    if (name === 'type') return interaction.options.getStringOriginal('typ');
                    return interaction.options.getStringOriginal(name);
                };

                return await filter.execute(interaction, config, client);
            }

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Unbekannter Befehl', 'Dieser Unterbefehl wurde nicht erkannt, Loco.')],
            });
        } catch (error) {
            logger.error('logging command error:', error);
            await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Fehler', 'Ein unerwarteter Fehler ist aufgetreten, Amigo.')],
                ephemeral: true,
            }).catch(() => {});
        }
    },
};
