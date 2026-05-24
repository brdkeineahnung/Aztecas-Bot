import { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from './logger.js';

export async function handleTicketInteraction(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_select:')) {
        await interaction.deferReply({ ephemeral: true });

        const [, teamRoleId, categoryId] = interaction.customId.split(':');
        const type = interaction.values[0];
        const { guild, user } = interaction;

        // Namen basierend auf Typ festlegen
        const channelNames = {
            bewerbung: `📝-apply-${user.username}`,
            support: `🛠️-help-${user.username}`,
            sonstiges: `📁-misc-${user.username}`
        };

        const ticketChannel = await guild.channels.create({
            name: channelNames[type],
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
                { id: teamRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] }
            ]
        });

        const ticketEmbed = new EmbedBuilder()
            .setColor('#00FFFF')
            .setTitle(`🦅 AZTECAS | ${type.toUpperCase()}`)
            .setDescription(
                `Hola <@${user.id}>, willkommen im Funkkanal.\n\n` +
                `**Anliegen:** ${type.charAt(0).toUpperCase() + type.slice(1)}\n` +
                `Bitte beschreibe jetzt alles so genau wie möglich. Ein <@&${teamRoleId}> wird sich melden.`
            )
            .setFooter({ text: 'Kanal schließen mit dem Button unten' });

        const closeBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_close').setLabel('Verbindung trennen').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ content: `<@${user.id}> | <@&${teamRoleId}>`, embeds: [ticketEmbed], components: [closeBtn] });
        await interaction.editReply({ content: `✅ Kanal erstellt: ${ticketChannel}` });
    }

    if (interaction.isButton() && interaction.customId === 'ticket_close') {
        await interaction.reply({ content: '🔒 Verbindung wird in 5 Sekunden getrennt...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
}
