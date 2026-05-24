import { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from './utils/logger.js'; // Pfad bei Bedarf an deine Struktur anpassen

async function handleTicketOpen(interaction) {
    // Ephemeral Defer, um das "Bot denkt nach..." anzuzeigen
    await interaction.deferReply({ ephemeral: true });

    const { guild, user, customId } = interaction;

    // Daten sauber trennen
    const [, teamRoleId, categoryId] = customId.split(':');

    try {
        const category = guild.channels.cache.get(categoryId);
        if (!category) {
            return await interaction.editReply({
                content: '❌ Die hinterlegte Ticket-Kategorie existiert nicht mehr. Bitte führe `/ticket-setup` neu aus.'
            });
        }

        // Spam-Schutz basierend auf dem Namen im Zielordner
        const channelName = `funk-${user.username.toLowerCase()}`.replace(/[^a-zA-Z0-9-]/g, '');
        const existingChannel = guild.channels.cache.find(
            c => c.name.startsWith(`funk-${user.username.toLowerCase()}`) && c.parentId === categoryId
        );
        
        if (existingChannel) {
            return await interaction.editReply({ 
                content: `⚠️ Du hast bereits eine aktive Funkverbindung: ${existingChannel}` 
            });
        }

        // Kanal mit sicheren Berechtigungen generieren
        const ticketChannel = await guild.channels.create({
            name: `funk-${user.username.toLowerCase()}`,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel], // Niemand sieht den Kanal...
                },
                {
                    id: user.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ], // ...außer der Ersteller...
                },
                {
                    id: teamRoleId,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles
                    ], // ...und die Support-Rolle.
                }
            ]
        });

        // Embed innerhalb des neuen Tickets
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#00FFFF')
            .setTitle('🔒 Abhörsicherer Kanal geöffnet')
            .setDescription(
                `Hola <@${user.id}>, deine Verbindung steht.\n\n` +
                `**Bitte mache direkt folgende Angaben, um die Bearbeitung zu beschleunigen:**\n` +
                `• Was ist dein konkretes Anliegen?\n` +
                `• Wie können wir dir helfen?\n\n` +
                `Die <@&${teamRoleId}> wurde benachrichtigt und wird sich in Kürze hier melden.`
            )
            .setTimestamp()
            .setFooter({ text: 'Aztecas Support • Kanal schließen via Button' });

        const closeButton = new ButtonBuilder()
            .setCustomId('ticket_close')
            .setLabel('Verbindung trennen')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeButton);

        // Nachricht im neuen Kanal posten
        await ticketChannel.send({ 
            content: `<@${user.id}> | <@&${teamRoleId}>`, 
            embeds: [welcomeEmbed], 
            components: [row] 
        });

        // Erfolgsmeldung für den User
        await interaction.editReply({ content: `✅ Deine Funkverbindung wurde hergestellt: ${ticketChannel}` });
        logger.info(`[Ticket] Kanal erstellt: ${ticketChannel.name} für ${user.tag}`);

    } catch (error) {
        logger.error('[Ticket] Fehler beim Erstellen des Kanals:', error);
        await interaction.editReply({ 
            content: '❌ Der Funkkanal konnte nicht erstellt werden. Bitte stelle sicher, dass der Bot die Berechtigung "Kanäle verwalten" besitzt.' 
        });
    }
}

async function handleTicketClose(interaction) {
    await interaction.deferReply();
    await interaction.editReply({ content: '🔒 **Die Verbindung wird getrennt. Kanal wird in 5 Sekunden gelöscht...**' });
    
    setTimeout(async () => {
        try {
            await interaction.channel.delete();
        } catch (error) {
            logger.error('[Ticket] Fehler beim Löschen des Kanals:', error);
        }
    }, 5000);
}

export async function handleTicketButtons(interaction) {
    if (interaction.customId.startsWith('ticket_open:')) {
        await handleTicketOpen(interaction);
    } else if (interaction.customId === 'ticket_close') {
        await handleTicketClose(interaction);
    }
}
