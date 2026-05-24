import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { getServerCounters, saveServerCounters, getCounterEmoji as getCounterTypeEmoji, getCounterTypeLabel, getGuildCounterStats } from '../../../services/serverstatsService.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export async function handleList(interaction, client) {
    const guild = interaction.guild;
    
    // Interaktion sofort aufschieben (Defer), um Timeouts zu verhindern
    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Fehler beim Aufschieben der Interaktion (Defer):", error);
        return;
    }
    
    // Berechtigungen nach dem Defer prüfen
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await InteractionHelper.safeEditReply(interaction, { 
            embeds: [errorEmbed("Du benötigst die Berechtigung **Kanäle verwalten**, um Counter anzuzeigen.")]
        }).catch(logger.error);
        return;
    }

    try {
        const counters = await getServerCounters(client, guild.id);
        const stats = await getGuildCounterStats(guild);

        // Bereinigung von Countern mit gelöschten Kanälen
        const validCounters = [];
        const orphanedCounters = [];
        
        for (const counter of counters) {
            const channel = guild.channels.cache.get(counter.channelId);
            if (channel) {
                validCounters.push(counter);
            } else {
                orphanedCounters.push(counter);
                logger.info(`Entferne verwaisten Counter ${counter.id} (Typ: ${counter.type}, gelöschter Kanal: ${counter.channelId}) von Guild ${guild.id}`);
            }
        }
        
        // Bereinigte Counter speichern, falls verwaiste Kanäle gefunden wurden
        if (orphanedCounters.length > 0) {
            await saveServerCounters(client, guild.id, validCounters);
            logger.info(`${orphanedCounters.length} verwaiste(r) Counter von Guild ${guild.id} bereinigt.`);
        }

        if (validCounters.length === 0) {
            const embed = createEmbed({
                title: "📋 Server-Counter",
                description: "Für diesen Server wurden noch keine Counter eingerichtet.\n\nNutze `/counter create`, um deinen ersten Counter zu erstellen!",
                color: getColor('warning')
            });

            embed.addFields({
                name: "🔧 **Verfügbare Counter-Typen**",
                value: "👥 **Mitglieder + Bots** - Gesamte Server-Mitglieder\n👤 **Nur Mitglieder** - Nur menschliche Benutzer\n🤖 **Nur Bots** - Nur Bot-Accounts",
                inline: false
            });

            embed.addFields({
                name: "📝 **Anwendungsbeispiele**",
                value: "`/counter create type:members channel_type:voice category:Statistiken`\n`/counter create type:bots channel_type:text category:Server Info`\n`/counter list`",
                inline: false
            });

            embed.setFooter({ 
                text: "Counter-System • Automatische Updates alle 15 Minuten" 
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] }).catch(logger.error);
            return;
        }

        const embed = createEmbed({
            title: `📋 Server-Counter (${validCounters.length})`,
            description: "Hier sind alle aktiven Counter für diesen Server.\n\nCounter aktualisieren sich automatisch alle 15 Minuten.",
            color: getColor('info')
        });

        for (let i = 0; i < validCounters.length; i++) {
            const counter = validCounters[i];
            const channel = guild.channels.cache.get(counter.channelId);
            
            if (!channel) {
                // Sicherheitsprüfung, falls sich trotz Filterung etwas überschnitten hat
                logger.warn(`Counter ${counter.id} hat nach Bereinigung immer noch einen fehlenden Kanal.`);
                continue;
            }

            const currentCount = getCurrentCount(stats, counter.type);
            const status = channel.name.includes(':') ? '✅ Aktiv' : '⚠️ Nicht aktualisiert';
            
            embed.addFields({
                name: `${getCounterTypeEmoji(counter.type)} Counter #${i + 1} - ${channel.name}`,
                value: `**ID:** \`${counter.id}\`\n**Typ:** ${getCounterTypeDisplay(counter.type)}\n**Kanal:** ${channel}\n**Aktueller Wert:** ${currentCount}\n**Status:** ${status}\n**Erstellt am:** ${new Date(counter.createdAt).toLocaleDateString('de-DE')}`,
                inline: false
            });
        }

        embed.addFields({
            name: "📊 **Statistiken**",
            value: `**Counter gesamt:** ${validCounters.length}\n**Aktive Counter:** ${validCounters.filter(c => {
                const channel = guild.channels.cache.get(c.channelId);
                return channel && channel.name.includes(':');
            }).length}\n**Nächstes Update:** <t:${Math.floor(Date.now() / 1000) + 900}:R>`,
            inline: false
        });

        embed.addFields({
            name: "🔧 **Verwaltungs-Befehle**",
            value: "`/counter create` - Neuen Counter erstellen\n`/counter update` - Bestehenden Counter manuell aktualisieren\n`/counter delete` - Counter löschen",
            inline: false
        });

        embed.setFooter({ 
            text: "Counter-System • Automatische Updates alle 15 Minuten" 
        });
        embed.setTimestamp();

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] }).catch(logger.error);

    } catch (error) {
        logger.error("Fehler beim Anzeigen der Counter:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("Beim Abrufen der Counter ist ein Fehler aufgetreten. Bitte versuche es erneut.")]
        }).catch(logger.error);
    }
}

function getCounterTypeDisplay(type) {
    return `${getCounterTypeEmoji(type)} ${getCounterTypeLabel(type)}`;
}

function getCounterEmoji(type) {
    return getCounterTypeEmoji(type);
}

function getCurrentCount(stats, type) {
    switch (type) {
        case "members":
            return stats.totalCount;
        case "bots":
            return stats.botCount;
        case "members_only":
            return stats.humanCount;
        default:
            return 0;
    }
}


