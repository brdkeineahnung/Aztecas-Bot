import { getColor } from '../../../config/bot.js';
import { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed, errorEmbed } from '../../../utils/embeds.js';
import { getServerCounters, saveServerCounters, getCounterEmoji, getCounterTypeLabel } from '../../../services/serverstatsService.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export async function handleDelete(interaction, client) {
    const guild = interaction.guild;
    const counterId = interaction.options.getString("counter-id");
    
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
            embeds: [errorEmbed("Du benötigst die Berechtigung **Kanäle verwalten**, um Counter zu löschen.")]
        }).catch(logger.error);
        return;
    }

    try {
        const counters = await getServerCounters(client, guild.id);

        if (counters.length === 0) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed("Es wurden keine Counter zum Löschen gefunden.")]
            }).catch(logger.error);
            return;
        }

        const counterToDelete = counters.find(c => c.id === counterId);
        if (!counterToDelete) {
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed(`Counter mit der ID \`${counterId}\` wurde nicht gefunden. Nutze \`/counter list\`, um alle Counter zu sehen.`)]
            }).catch(logger.error);
            return;
        }

        const channel = guild.channels.cache.get(counterToDelete.channelId);

        const embed = createEmbed({
            title: "⚠️ Counter & Kanal löschen",
            description: `Bist du sicher, dass du diesen Counter und den dazugehörigen Kanal löschen möchtest?\n\n**ID:** \`${counterToDelete.id}\`\n**Typ:** ${getCounterTypeDisplay(counterToDelete.type)}\n**Kanal:** ${channel || 'Bereits gelöschter Kanal'}\n\n⚠️ **Der Kanal wird unwiderruflich gelöscht!**`,
            color: getColor('error')
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`counter-delete:confirm:${counterToDelete.id}:${interaction.user.id}`)
                .setLabel("Löschen bestätigen")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`counter-delete:cancel:${counterToDelete.id}:${interaction.user.id}`)
                .setLabel("Abbrechen")
                .setStyle(ButtonStyle.Secondary)
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed], components: [row] }).catch(logger.error);

    } catch (error) {
        logger.error("Fehler in handleDelete:", error);
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [errorEmbed("Beim Abrufen der Counter ist ein Fehler aufgetreten. Bitte versuche es erneut.")]
        }).catch(logger.error);
    }
}

export async function performDeletionByCounterId(client, guild, counterId) {
    try {
        const counters = await getServerCounters(client, guild.id);

        const counter = counters.find(c => c.id === counterId);
        if (!counter) {
            return {
                success: false,
                message: `Counter mit der ID \`${counterId}\` wurde nicht gefunden.`
            };
        }

        const updatedCounters = counters.filter(c => c.id !== counter.id);

        const saved = await saveServerCounters(client, guild.id, updatedCounters);
        if (!saved) {
            return {
                success: false,
                message: "Der Counter konnte nicht gelöscht werden. Bitte versuche es erneut."
            };
        }

        const channel = guild.channels.cache.get(counter.channelId);
        let channelDeleted = false;

        if (channel) {
            try {
                await channel.delete(`Counter gelöscht - Kanal entfernt: ${counter.id}`);
                channelDeleted = true;
            } catch (error) {
                logger.error("Fehler beim Löschen des Kanals:", error);
            }
        }

        let message = `✅ **Counter erfolgreich gelöscht!**\n\n**ID:** \`${counter.id}\`\n**Typ:** ${getCounterTypeDisplay(counter.type)}`;
        
        if (channelDeleted) {
            message += `\n**Kanal:** ${channel.name} (gelöscht)`;
        } else if (channel) {
            message += `\n**Kanal:** ${channel.name} (Löschen fehlgeschlagen)`;
        } else {
            message += `\n**Kanal:** Bereits gelöscht`;
        }

        return {
            success: true,
            message
        };

    } catch (error) {
        logger.error("Fehler beim Löschen des Counters:", error);
        return {
            success: false,
            message: "Beim Löschen des Counters ist ein Fehler aufgetreten. Bitte versuche es erneut."
        };
    }
}

function getCounterTypeDisplay(type) {
    return `${getCounterEmoji(type)} ${getCounterTypeLabel(type)}`;
}


