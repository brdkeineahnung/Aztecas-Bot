import { EmbedBuilder } from 'discord.js';

export async function handleLagerInteraction(interaction) {
    // Kurzes unsichtbares Defer, um Discord zu signalisieren, dass gearbeitet wird
    await interaction.deferUpdate();

    const embed = interaction.message.embeds[0];
    if (!embed) return;

    // Aktuelle Werte aus den Feldern auslesen
    let westenField = embed.fields[0].value;
    let medkitsField = embed.fields[1].value;

    // Extrahiert die Zahlen aus dem Text (z.B. aus "Anzahl: `12`" wird 12)
    let westenCount = parseInt(westenField.match(/\d+/)[0]);
    let medkitsCount = parseInt(medkitsField.match(/\d+/)[0]);

    // Aktion je nach Button-Klick ausführen
    if (interaction.customId === 'lager_add_westen') westenCount++;
    if (interaction.customId === 'lager_remove_westen' && westenCount > 0) westenCount--;
    
    if (interaction.customId === 'lager_add_medkits') medkitsCount++;
    if (interaction.customId === 'lager_remove_medkits' && medkitsCount > 0) medkitsCount--;

    // Neues Embed mit aktualisierten Werten bauen
    const updatedEmbed = new EmbedBuilder(embed.data)
        .setFields(
            { name: '🟢 Schutzwesten', value: `📦 Anzahl: \`${westenCount}\``, inline: true },
            { name: '🟢 Medkits', value: `📦 Anzahl: \`${medkitsCount}\``, inline: true }
        )
        .setTimestamp();

    // Nachricht mit dem neuen Embed aktualisieren
    await interaction.message.edit({ embeds: [updatedEmbed] });
}
