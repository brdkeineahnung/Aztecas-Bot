import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError } from '../../utils/errorHandler.js';
import greetDashboard from './modules/greet_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('greet')
        .setDescription('Manage welcome & goodbye settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('Open the welcome & goodbye configuration dashboard'),
        ),

    async execute(interaction, config, client) {
        // Interaktion frühzeitig flüchtig aufschieben, da Dashboards Ladezeit beanspruchen
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) {
            logger.warn(`Greet interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'greet'
            });
            return;
        }

        try {
            // Berechtigungsprüfung
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        errorEmbed(
                            'Missing Permissions',
                            'You need the **Manage Server** permission to use `/greet`.',
                        ),
                    ],
                });
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'dashboard':
                    // Wichtig: greetDashboard.execute muss intern nun ebenfalls safeEditReply nutzen!
                    return await greetDashboard.execute(interaction, config, client);
                default:
                    logger.warn(`Unknown /greet subcommand: ${subcommand}`);
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [errorEmbed('Unknown Subcommand', 'This subcommand is not implemented yet.')]
                    });
            }
        } catch (error) {
            if (error instanceof TitanBotError) {
                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed('Configuration Error', error.userMessage || 'Something went wrong.')],
                });
            }
            // Übergibt den Fehler an dein globales Fehler-Handling
            await handleInteractionError(interaction, error, { command: 'greet' });
        }
    },
};
