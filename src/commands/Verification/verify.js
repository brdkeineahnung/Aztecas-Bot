import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { errorEmbed, infoEmbed, successEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { verifyUser } from '../../services/verificationService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify yourself and gain access to the server'),

    async execute(interaction, config, client) {
        const wrappedExecute = withErrorHandling(async () => {
            const guild = interaction.guild;

            // Führe die Verifizierung über den zentralen Service aus
            const result = await verifyUser(client, guild.id, interaction.user.id, {
                source: 'command_self',
                moderatorId: null
            });

            // Wenn die Verifizierung nicht erfolgreich war
            if (!result.success) {
                if (result.alreadyVerified) {
                    return await InteractionHelper.safeReply(interaction, {
                        embeds: [infoEmbed("Already Verified", "You are already verified in this server.")],
                        flags: MessageFlags.Ephemeral
                    });
                }

                // Generischer Fehlerfall (sofern nicht bereits durch den Error-Wrapper abgefangen)
                return await InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed(
                        "Verification Failed",
                        "An error occurred during verification. Please try again or contact a server administrator."
                    )],
                    flags: MessageFlags.Ephemeral
                });
            }

            // Erfolgreiche Verifizierung
            return await InteractionHelper.safeReply(interaction, {
                embeds: [successEmbed(
                    "Verification Complete",
                    `You have been successfully verified and given the **${result.roleName || 'Verified'}** role! Welcome to the server! 🎉`
                )],
                flags: MessageFlags.Ephemeral
            });
            
        }, { command: 'verify' });

        return await wrappedExecute(interaction, config, client);
    }
};
