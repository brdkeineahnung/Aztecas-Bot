import { handleTicketInteraction } from '../utils/ticketHandler.js';
import { handleInteractionError } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';

export default {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // Sicherheits-Check: Nur Interaktionen auf Servern verarbeiten
        if (!interaction.guild) {
            return logger.warn(`[Interaction] Interaktion von ${interaction.user.tag} außerhalb eines Servers ignoriert.`);
        }

        // ── 1. TICKET-SYSTEM (Autark & DB-unabhängig) ────────────────────────
        const isTicketMenu = interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_select:');
        const isTicketButton = interaction.isButton() && interaction.customId === 'ticket_close';

        if (isTicketMenu || isTicketButton) {
            logger.info(`[Ticket-System] Interaktion aufgerufen von ${interaction.user.tag} (${interaction.user.id}) auf Server: ${interaction.guild.name}`);
            try {
                return await handleTicketInteraction(interaction);
            } catch (ticketError) {
                logger.error('[Ticket-System] Kritischer Fehler im Ticket-Handler:', ticketError);
                
                // Dem User eine sichere Rückmeldung geben, falls etwas schiefgeht
                const errorResponse = { content: '❌ Ein Fehler beim Verarbeiten des Tickets ist aufgetreten.', ephemeral: true };
                if (interaction.deferred || interaction.replied) {
                    return await interaction.editReply(errorResponse).catch(() => {});
                } else {
                    return await interaction.reply(errorResponse).catch(() => {});
                }
            }
        }

        // ── 2. AUTOCOMPLETE COMMANDS (Optionen-Vorauswahl) ───────────────────
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                return await command.autocomplete(interaction, client);
            } catch (autocompleteError) {
                return logger.error(`[Autocomplete] Fehler bei Befehl /${interaction.commandName}:`, autocompleteError);
            }
        }

        // ── 3. SLASH COMMANDS (Reguläre Bot-Befehle) ─────────────────────────
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            
            // Falls der Befehl nicht existiert, abbrechen
            if (!command) {
                logger.warn(`[Command] Unbekannter Slash-Command aufgerufen: /${interaction.commandName} von ${interaction.user.tag}`);
                return;
            }

            logger.info(`[Command] /${interaction.commandName} ausgeführt von ${interaction.user.tag} in #${interaction.channel.name} (${interaction.guild.name})`);

            try {
                // Hier wird der Befehl ausgeführt. 
                // Falls deine Datenbank hier Probleme macht, fängt der catch-Block das ab.
                await command.execute(interaction, {}, client); 
            } catch (error) {
                logger.error(`[Command-Fehler] Fehler bei der Ausführung von /${interaction.commandName}:`, error);
                
                // Übergabe an dein globales Fehler-Handling für eine saubere Admin-Meldung
                try {
                    await handleInteractionError(interaction, error, { command: interaction.commandName });
                } catch (fallbackError) {
                    logger.error('[Fataler Fehler] Globaler Error-Handler ist fehlgeschlagen:', fallbackError);
                    
                    // Notfall-Antwort an den User, falls das errorHandler-Modul selbst crasht
                    const fallbackMessage = { content: '⚠️ Ein interner Fehler ist aufgetreten (Datenbank- oder Systemfehler). Bitte versuche es später erneut.', ephemeral: true };
                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply(fallbackMessage).catch(() => {});
                    } else {
                        await interaction.reply(fallbackMessage).catch(() => {});
                    }
                }
            }
        }
    }
};
