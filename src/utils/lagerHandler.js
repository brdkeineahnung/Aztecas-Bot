import { EmbedBuilder } from 'discord.js';

export async function handleLagerInteraction(interaction) {
    // Bestätigt die Interaktion sofort visuell bei Discord
    await interaction.deferUpdate().catch(() => {});

    const embed = interaction.message.embeds[0];
    if (!embed) return;

    let westenField = embed.fields[0].value;
    let medkitsField = embed.fields[1].value;

    // Filtert die reinen Zahlenwerte aus dem alten Text heraus
    let westenCount = parseInt(westenField.match(/\d+/)[0]) || 0;
    let medkitsCount = parseInt(medkitsField.match(/\d+/)[0]) || 0;

    // Berechnungen durchführen
    if (interaction.customId === 'lager_add_westen') westenCount++;
    if (interaction.customId === 'lager_remove_westen' && westenCount > 0) westenCount--;
    
    if (interaction.customId === 'lager_add_medkits') medkitsCount++;
    if (interaction.customId === 'lager_remove_medkits' && medkitsCount > 0) medkitsCount--;

    // Neues Embed mit den upgedateten Werten zusammensetzen
    const updatedEmbed = new EmbedBuilder(embed.data)
        .setFields(
            { name: '🟢 Schutzwesten', value: ` Anzahlen: \`${westenCount}\``, inline: true },
            { name: '🟢 Medkits', value: ` Anzahlen: \`${medkitsCount}\``, inline: true }
        )
        .setTimestamp();

    await interaction.message.edit({ embeds: [updatedEmbed] }).catch(() => {});
}
