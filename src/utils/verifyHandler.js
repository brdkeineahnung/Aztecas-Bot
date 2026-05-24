export async function handleVerifyInteraction(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const roleId = interaction.client.verifyRoleId;
    if (!roleId) {
        return await interaction.editReply({ content: '❌ Das Verifikationssystem ist derzeit nicht konfiguriert. Bitte Admin kontaktieren.' });
    }

    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
        return await interaction.editReply({ content: '❌ Die zugewiesene Rolle wurde auf diesem Server nicht gefunden.' });
    }

    try {
        if (interaction.member.roles.cache.has(roleId)) {
            return await interaction.editReply({ content: '⚠️ Du bist bereits ein bestätigtes Mitglied der Familie, hermano!' });
        }

        await interaction.member.roles.add(role);
        await interaction.editReply({ content: `🎉 ¡Bienvenido! Dir wurde die Rolle **${role.name}** erfolgreich zugewiesen.` });
    } catch (error) {
        await interaction.editReply({ content: '❌ Mir fehlen die Berechtigungen, um dir diese Rolle zu geben (Prüfe die Bot-Rollenhierarchie!).' });
    }
}
