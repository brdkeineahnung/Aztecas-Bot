import { PermissionFlagsBits, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { getServerCounters, saveServerCounters, updateCounter, getCounterBaseName, getCounterTypeLabel } from '../../../services/serverstatsService.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export async function handleCreate(interaction, client) {
    const guild = interaction.guild;
    const type = interaction.options.getString("type");
    const channelType = interaction.options.getString("channel_type");
    const category = interaction.options.getChannel("category");

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
            embeds: [errorEmbed("Du benötigst die Berechtigung **Kanäle verwalten**, um Counter zu erstellen.")]
        }).catch(logger.error);
        return;
    }

    try {
        if (!category || category.type !== ChannelType.GuildCategory) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("Bitte wähle eine gültige Kategorie für den Counter-Kanal aus.")]
            }).catch(logger.error);
            return;
        }

        const targetChannelType = channelType === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
        const baseChannelName = getCounterBaseName(type);

        const counters = await getServerCounters(client, guild.id);

        const duplicateType = counters.find(counter => counter.type === type);

        if (duplicateType) {
            const duplicateChannel = guild.channels.cache.get(duplicateType.channelId);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed(`Ein **${getCounterTypeLabel(type)}**-Counter existiert bereits auf diesem Server${duplicateChannel ? ` in ${duplicateChannel}` : ''}. Lösche diesen zuerst, bevor du einen neuen erstellst.`)]
            }).catch(logger.error);
            return;
        }

        const targetChannel = await guild.channels.create({
            name: baseChannelName,
            type: targetChannelType,
            parent: category.id,
            reason: `Counter-Kanal erstellt von ${interaction.user.tag}`
        });

        const existingCounter = counters.find(c => c.channelId === targetChannel.id);
        if (existingCounter) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed(`Es existiert bereits ein Counter für den Kanal **${targetChannel.name}**. Bitte lösche diesen zuerst oder wähle einen anderen Typen.`)]
            }).catch(logger.error);
            return;
        }

        const newCounter = {
            id: Date.now().toString(),
            type: type,
            channelId: targetChannel.id,
            guildId: guild.id,
            createdAt: new Date().toISOString(),
            enabled: true
        };

        counters.push(newCounter);

        const saved = await saveServerCounters(client, guild.id, counters);
        if (!saved) {
            await targetChannel.delete('Counter-Erstellung beim Speichern fehlgeschlagen').catch(() => null);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("Die Counter-Daten konnten nicht gespeichert werden. Bitte versuche es erneut.")]
            }).catch(logger.error);
            return;
        }

        const updated = await updateCounter(client, guild, newCounter);
        if (!updated) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("Der Counter wurde erstellt, aber der Kanalname konnte nicht aktualisiert werden. Der Counter aktualisiert sich beim nächsten geplanten Durchlauf.")]
            }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(`✅ **Counter erfolgreich erstellt!**\n\n**Typ:** ${getCounterTypeLabel(type)}\n**Kanaltyp:** ${targetChannel.type === ChannelType.GuildVoice ? 'Sprachkanal' : 'Textkanal'}\n**Kategorie:** ${category}\n**Kanal:** ${targetChannel}\n**Kanalname:** ${targetChannel.name}\n**Counter-ID:** \`${newCounter.id}\`\n\nDer Counter aktualisiert sich automatisch alle 15 Minuten.\n\nNutze \`/counter list\`, um alle Counter anzuzeigen.`)]
        }).catch(logger.error);

    } catch (error) {
        logger.error("Fehler beim Erstellen des Counters:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("Beim Erstellen des Counters ist ein Fehler aufgetreten. Bitte versuche es erneut.")]
        }).catch(logger.error);
    }
}
