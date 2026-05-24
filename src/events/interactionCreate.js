import { handleTicketInteraction } from '../utils/ticketHandler.js';
import { handleVerifyInteraction } from '../utils/verifyHandler.js';
import { handleLagerInteraction } from '../utils/lagerHandler.js';

export default {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.guild) return;

        // 1. EVENT-FILTER FÜR SYSTEME (Umgeht die Datenbank)
        if (interaction.isButton()) {
            // Verifikation
            if (interaction.customId === 'verify_member') {
                return await handleVerifyInteraction(interaction);
            }
            // Lagerverwaltung
            if (interaction.customId.startsWith('lager_')) {
                return await handleLagerInteraction(interaction);
            }
            // Ticket schließen
            if (interaction.customId === 'ticket_close') {
                return await handleTicketInteraction(interaction);
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_select:')) {
            return await handleTicketInteraction(interaction);
        }

        // 2. REGULÄRE SLASH-COMMANDS
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`[Command Fehler] /${interaction.commandName}:`, error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ 
                        content: '❌ Fehler beim Ausführen des Befehls.', 
                        ephemeral: true 
                    }).catch(() => {});
                }
            }
        }
    }
};
