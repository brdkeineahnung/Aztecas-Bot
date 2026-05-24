import { PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getServerCounters, saveServerCounters, updateCounter, getCounterEmoji, getCounterTypeLabel } from '../../../services/serverstatsService.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export async function handleUpdate(interaction, client) {
    const guild = interaction.guild;
    const counterId = interaction.options.getString("counter-id");
    const newType = interaction.options.getString("type");

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
            embeds: [errorEmbed("Du benötigst die Berechtigung **Kanäle verwalten**, um Counter zu aktualisieren.")]
        }).catch(logger.error);
        return;
    }

    if (!newType) {
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("Du musst einen neuen Counter-Typen angeben, um die Aktualisierung durchzuführen.")]
        }).catch(logger.error);
        return;
    }

    try {
        const counters = await getServerCounters(client, guild.id);

        const counterIndex = counters.findIndex(c => c.id === counterId);
        if (counterIndex === -1) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed(`Counter mit der ID \`${counterId}\` wurde nicht gefunden. Nutze \`/counter list\`, um alle Counter zu sehen.`)]
            }).catch(logger.error);
            return;
        }

        const counter = counters[counterIndex];
        const oldChannel = guild.channels.cache.get(counter.channelId);

        if (!oldChannel) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("Der Kanal für diesen Counter existiert nicht mehr. Du kannst keinen Counter für einen gelöschten Kanal aktualisieren.")]
            }).catch(logger.error);
            return;
        }

        if (newType !== counter.type) {
            const existingTypeCounter = counters.find(c => c.type === newType && c.id !== counter.id);
            if (existingTypeCounter) {
                const existingChannel = guild.channels.cache.get(existingTypeCounter.channelId);
                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [errorEmbed(`Ein **${getCounterTypeLabel(newType)}**-Counter existiert bereits auf diesem Server${existingChannel ? ` in ${existingChannel}` : ''}. Lösche diesen zuerst, bevor du diesen Typen erneut verwendest.`)]
                }).catch(logger.error);
                return;
            }
        }

        const oldType = counter.type;

        counter.type = newType;
        counter.updatedAt = new Date().toISOString();

        const saved = await saveServerCounters(client, guild.id, counters);
        if (!saved) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("Die aktualisierten Counter-Daten konnten nicht gespeichert werden. Bitte versuche es erneut.")]
            }).catch(logger.error);
            return;
        }

        const updatedCounter = counters[counterIndex];
        const updated = await updateCounter(client, guild, updatedCounter);
        if (!updated) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("Der Counter wurde aktualisiert, aber der Kanalname konnte nicht angepasst werden. Der Counter aktualisiert sich beim nächsten geplanten Durchlauf.")]
            }).catch(logger.error);
            return;
        }

        const finalChannel = guild.channels.cache.get(updatedCounter.channelId);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(`✅ **Counter erfolgreich aktualisiert!**\n\n**Counter-ID:** \`${counterId}\`\n**Typ geändert:** ${getCounterEmoji(oldType)} ${getCounterTypeLabel(oldType)} → ${getCounterEmoji(newType)} ${getCounterTypeLabel(newType)}\n\n**Aktuelle Einstellungen:**\n**Typ:** ${getCounterEmoji(updatedCounter.type)} ${getCounterTypeLabel(updatedCounter.type)}\n**Kanal:** ${finalChannel}\n**Kanalname:** ${finalChannel.name}\n\nDer Counter aktualisiert sich automatisch alle 15 Minuten.`)]
        }).catch(logger.error);

    } catch (error) {
        logger.error("Fehler beim Aktualisieren des Counters:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("Beim Aktualisieren des Counters ist ein Fehler aufgetreten. Bitte versuche es erneut.")]
        }).catch(logger.error);
    }
}


