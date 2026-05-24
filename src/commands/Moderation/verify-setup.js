import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('verify-setup')
        .setDescription('Erstellt das Verifikations-Panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addChannelOption(option =>
            option.setName('channel').setDescription('Kanal für das Panel').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption(option =>
            option.setName('role').setDescription('Die Rolle, die vergeben wird').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');

        const embed = new EmbedBuilder()
            .setColor('#00FFFF')
            .setTitle('🛡️ BARRIO GRENZKONTROLLE')
            .setDescription(
                '¡Hola! Um Zugriff auf die internen Bereiche des Reiches zu erhalten, musst du dich verifizieren.\n\n' +
                'Mit dem Klick auf den Button bestätigst du, dass du den Codex gelesen hast und die Familie respektierst.'
            )
            .setFooter({ text: 'Aztecas Schutzsystem' });

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('verify_member')
                .setLabel('Einreise bestätigen')
                .setEmoji('🦅')
                .setStyle(ButtonStyle.Success)
        );

        // Rolle temporär im Client speichern, damit der Handler weiß, welche Rolle gemeint ist
        interaction.client.verifyRoleId = role.id;

        try {
            await channel.send({ embeds: [embed], components: [button] });
            await interaction.editReply({ content: `✅ Verifikations-Panel in ${channel} aufgestellt! Rolle: ${role}` });
        } catch (error) {
            await interaction.editReply({ content: '❌ Fehler beim Senden des Panels.' });
        }
    }
};
