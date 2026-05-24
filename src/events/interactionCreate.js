import { InteractionType, MessageFlags } from 'discord.js';
import { handleTicketInteraction } from '../utils/ticketHandler.js';
import { handleLagerInteraction } from '../handlers/lagerHandler.js';
import { handleInteractionError } from '../utils/errorHandler.js'; // Nutzt den TitanBot-Standard
import { logger } from '../utils/logger.js';

export default {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (!interaction.guild) return;

        // =================================================================
        // 🔥 AZTECAS SCHUTZSCHILD: BUTTONS & MENÜS DIREKT ABFANGEN
        // Hierdurch wird jede Datenbankabfrage für deine Systeme umgangen!
        // =================================================================
        
        // 1. Lagerbestand-Buttons
        if (interaction.isButton() && interaction.customId.startsWith('lager_')) {
            try {
                return await handleLagerInteraction(interaction);
            } catch (error) {
                logger.error('[Aztecas Lager] Fehler:', error);
                return;
            }
        }

        // 2. Ticket-Schließen Button
        if (interaction.isButton() && interaction.customId === 'ticket_close') {
            try {
                return await handleTicketInteraction(interaction);
            } catch (error) {
                logger.error('[Aztecas Ticket-Close] Fehler:', error);
                return;
            }
        }

        // 3. Ticket-Auswahlmenü
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_select:')) {
            try {
                return await handleTicketInteraction(interaction);
            } catch (error) {
                logger.error('[Aztecas Ticket-Select] Fehler:', error);
                return;
            }
        }

        // =================================================================
        // 🤖 ORIGINAL TITANBOT CORE-LOGIK (Unverändert für alle anderen Module)
        // =================================================================

        // Autocomplete für Befehle
        if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.autocomplete(interaction, client);
            } catch (error) {
                logger.error(`[Autocomplete] Fehler bei /${interaction.commandName}:`, error);
            }
            return;
        }

        // Reguläre Slash-Commands ausführen
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                // Das Framework lädt hier im Hintergrund die DB-Config.
                // Wenn es hier kracht, sind deine Tickets und das Lager oben geschützt!
                await command.execute(interaction, client);
            } catch (error) {
                logger.error(`[Command-Fehler] /${interaction.commandName}:`, error);
                try {
                    await handleInteractionError(interaction, error, { command: interaction.commandName });
                } catch (fallbackError) {
                    const msg = { content: '⚠️ Ein interner Systemfehler ist aufgetreten.', flags: MessageFlags.Ephemeral };
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply(msg).catch(() => {});
                    } else {
                        await interaction.reply(msg).catch(() => {});
                    }
                }
            }
        }
    }
};
