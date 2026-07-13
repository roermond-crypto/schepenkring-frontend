import { getDictionary, type AppLocale } from "@/lib/i18n";

// Turns raw audit-log data (dotted action keys, PHP FQCNs, snapshot diffs)
// into human-readable text for the dashboard's audit cards and their
// expanded technical-details view. Standalone module (not routed through
// the app's JSON dictionaries/useTranslations) because the lookup keys here
// are dynamic runtime strings (action keys, column names) rather than
// static template paths — same reasoning as notification-i18n.ts.

export type AuditActor = {
  id: number;
  name?: string | null;
  type?: string | null;
  email?: string | null;
} | null | undefined;

// Verb phrases meant to follow an actor's name ("{actor} {phrase}") or, when
// there's no actor (system/automated events), a generic subject
// ("{genericSubject} {phrase}"). Covers every action logged through
// ActionSecurity::log() — the app's official, curated audit trail.
const ACTION_PHRASES: Record<string, Record<AppLocale, string>> = {
  "auth.login": { nl: "heeft ingelogd", en: "logged in", de: "hat sich angemeldet", fr: "s'est connecté(e)" },
  "auth.logout": { nl: "heeft uitgelogd", en: "logged out", de: "hat sich abgemeldet", fr: "s'est déconnecté(e)" },
  "auth.register": { nl: "heeft een account aangemaakt", en: "registered an account", de: "hat ein Konto erstellt", fr: "a créé un compte" },
  "me.profile.update": { nl: "heeft het profiel bijgewerkt", en: "updated their profile", de: "hat das Profil aktualisiert", fr: "a mis à jour son profil" },
  "me.personal.update": { nl: "heeft de persoonlijke gegevens bijgewerkt", en: "updated their personal details", de: "hat die persönlichen Daten aktualisiert", fr: "a mis à jour ses informations personnelles" },
  "me.address.update": { nl: "heeft het adres bijgewerkt", en: "updated their address", de: "hat die Adresse aktualisiert", fr: "a mis à jour son adresse" },
  "me.password.update": { nl: "heeft het wachtwoord gewijzigd", en: "changed their password", de: "hat das Passwort geändert", fr: "a changé son mot de passe" },
  "me.security.update": { nl: "heeft de beveiligingsinstellingen bijgewerkt", en: "updated their security settings", de: "hat die Sicherheitseinstellungen aktualisiert", fr: "a mis à jour ses paramètres de sécurité" },
  "admin.user.create": { nl: "heeft een gebruiker aangemaakt", en: "created a user account", de: "hat ein Benutzerkonto erstellt", fr: "a créé un compte utilisateur" },
  "admin.user.update": { nl: "heeft een gebruiker bijgewerkt", en: "updated a user account", de: "hat ein Benutzerkonto aktualisiert", fr: "a mis à jour un compte utilisateur" },
  "admin.user.disable": { nl: "heeft een gebruiker gedeactiveerd", en: "disabled a user account", de: "hat ein Benutzerkonto deaktiviert", fr: "a désactivé un compte utilisateur" },
  "admin.user.locations": { nl: "heeft een locatietoewijzing bijgewerkt", en: "updated a user's location assignment", de: "hat eine Standortzuweisung aktualisiert", fr: "a mis à jour une affectation de site" },
  "impersonation.start": { nl: "is een impersonatiesessie gestart", en: "started impersonating a user", de: "hat eine Identitätsübernahme gestartet", fr: "a commencé à usurper l'identité d'un utilisateur" },
  "impersonation.stop": { nl: "heeft de impersonatiesessie beëindigd", en: "stopped impersonating a user", de: "hat die Identitätsübernahme beendet", fr: "a arrêté d'usurper l'identité d'un utilisateur" },
  "bid.created": { nl: "heeft een bod geplaatst", en: "placed a bid", de: "hat ein Gebot abgegeben", fr: "a placé une offre" },
  "bidder.registered": { nl: "heeft zich geregistreerd als bieder", en: "registered as a bidder", de: "hat sich als Bieter registriert", fr: "s'est inscrit comme enchérisseur" },
  "bidder.verified": { nl: "heeft een bieder geverifieerd", en: "verified a bidder", de: "hat einen Bieter verifiziert", fr: "a vérifié un enchérisseur" },
  "contract.generate": { nl: "heeft een contract gegenereerd", en: "generated a contract", de: "hat einen Vertrag erstellt", fr: "a généré un contrat" },
  "lead.address.enriched": { nl: "heeft leadgegevens verrijkt", en: "enriched a lead's address data", de: "hat Lead-Adressdaten angereichert", fr: "a enrichi les données d'adresse d'un prospect" },
  "lead.assigned": { nl: "heeft een lead toegewezen", en: "assigned a lead", de: "hat einen Lead zugewiesen", fr: "a assigné un prospect" },
  "lead.converted": { nl: "heeft een lead omgezet naar klant", en: "converted a lead to a client", de: "hat einen Lead in einen Kunden umgewandelt", fr: "a converti un prospect en client" },
  "lead.created": { nl: "heeft een lead aangemaakt", en: "created a lead", de: "hat einen Lead erstellt", fr: "a créé un prospect" },
  "lead.message.created": { nl: "heeft een leadbericht toegevoegd", en: "added a message to a lead", de: "hat eine Nachricht zu einem Lead hinzugefügt", fr: "a ajouté un message à un prospect" },
  "lead.status.changed": { nl: "heeft de leadstatus gewijzigd", en: "changed a lead's status", de: "hat den Lead-Status geändert", fr: "a modifié le statut d'un prospect" },
  "lead.updated": { nl: "heeft een lead bijgewerkt", en: "updated a lead", de: "hat einen Lead aktualisiert", fr: "a mis à jour un prospect" },
  "platform.created": { nl: "heeft een platform aangemaakt", en: "created a platform", de: "hat eine Plattform erstellt", fr: "a créé une plateforme" },
  "platform.updated": { nl: "heeft een platform bijgewerkt", en: "updated a platform", de: "hat eine Plattform aktualisiert", fr: "a mis à jour une plateforme" },
  "platform.deleted": { nl: "heeft een platform verwijderd", en: "deleted a platform", de: "hat eine Plattform gelöscht", fr: "a supprimé une plateforme" },
  "platform.logo.uploaded": { nl: "heeft een platformlogo geüpload", en: "uploaded a platform logo", de: "hat ein Plattform-Logo hochgeladen", fr: "a téléversé un logo de plateforme" },
  "platform.test_connection": { nl: "heeft een verbindingstest uitgevoerd", en: "ran a connection test", de: "hat einen Verbindungstest durchgeführt", fr: "a effectué un test de connexion" },
  "platform.publication.synced": { nl: "heeft een boot gesynchroniseerd met een platform", en: "synced a boat to a platform", de: "hat ein Boot mit einer Plattform synchronisiert", fr: "a synchronisé un bateau avec une plateforme" },
  "platform.publication.failed": { nl: "kon een boot niet synchroniseren met een platform", en: "failed to sync a boat to a platform", de: "konnte ein Boot nicht mit einer Plattform synchronisieren", fr: "n'a pas pu synchroniser un bateau avec une plateforme" },
  "platform.export.feed_generated": { nl: "heeft een testfeed gegenereerd", en: "generated a test feed", de: "hat einen Test-Feed generiert", fr: "a généré un flux de test" },
  "platform.export.feed_failed": { nl: "kon geen testfeed genereren", en: "failed to generate a test feed", de: "konnte keinen Test-Feed generieren", fr: "n'a pas pu générer de flux de test" },
  "platform.export.validation_failed": { nl: "genereerde een feed die niet voldoet aan de OpenMarine-validatie", en: "generated a feed that fails OpenMarine validation", de: "hat einen Feed generiert, der die OpenMarine-Validierung nicht besteht", fr: "a généré un flux qui échoue à la validation OpenMarine" },
  "partner.created": { nl: "heeft een partneraccount aangemaakt", en: "created a partner account", de: "hat ein Partnerkonto erstellt", fr: "a créé un compte partenaire" },
  "signhost.cancel": { nl: "heeft een ondertekeningsverzoek geannuleerd", en: "cancelled a signing request", de: "hat eine Signaturanfrage storniert", fr: "a annulé une demande de signature" },
  "signhost.request": { nl: "heeft een ondertekeningsverzoek verstuurd", en: "sent a signing request", de: "hat eine Signaturanfrage gesendet", fr: "a envoyé une demande de signature" },
  "signhost.resend": { nl: "heeft een ondertekeningsverzoek opnieuw verstuurd", en: "resent a signing request", de: "hat eine Signaturanfrage erneut gesendet", fr: "a renvoyé une demande de signature" },
  "signhost.status.updated": { nl: "heeft een ondertekeningsstatus bijgewerkt", en: "updated a signing status", de: "hat einen Signaturstatus aktualisiert", fr: "a mis à jour un statut de signature" },
  "task.accept": { nl: "heeft een taak geaccepteerd", en: "accepted a task", de: "hat eine Aufgabe angenommen", fr: "a accepté une tâche" },
  "task.attachment.add": { nl: "heeft een bijlage toegevoegd", en: "added a task attachment", de: "hat einen Aufgabenanhang hinzugefügt", fr: "a ajouté une pièce jointe à une tâche" },
  "task.attachment.delete": { nl: "heeft een bijlage verwijderd", en: "removed a task attachment", de: "hat einen Aufgabenanhang entfernt", fr: "a supprimé une pièce jointe d'une tâche" },
  "task.comment.add": { nl: "heeft op een taak gereageerd", en: "commented on a task", de: "hat eine Aufgabe kommentiert", fr: "a commenté une tâche" },
  "task.create": { nl: "heeft een taak aangemaakt", en: "created a task", de: "hat eine Aufgabe erstellt", fr: "a créé une tâche" },
  "task.delete": { nl: "heeft een taak verwijderd", en: "deleted a task", de: "hat eine Aufgabe gelöscht", fr: "a supprimé une tâche" },
  "task.reject": { nl: "heeft een taak afgewezen", en: "rejected a task", de: "hat eine Aufgabe abgelehnt", fr: "a rejeté une tâche" },
  "task.remind": { nl: "heeft een taakherinnering verstuurd", en: "sent a task reminder", de: "hat eine Aufgabenerinnerung gesendet", fr: "a envoyé un rappel de tâche" },
  "task.reorder": { nl: "heeft taken opnieuw gerangschikt", en: "reordered tasks", de: "hat Aufgaben neu geordnet", fr: "a réorganisé des tâches" },
  "task.reschedule": { nl: "heeft een taak verzet", en: "rescheduled a task", de: "hat eine Aufgabe verschoben", fr: "a reprogrammé une tâche" },
  "task.status.update": { nl: "heeft een taakstatus bijgewerkt", en: "updated a task's status", de: "hat einen Aufgabenstatus aktualisiert", fr: "a mis à jour le statut d'une tâche" },
  "task.update": { nl: "heeft een taak bijgewerkt", en: "updated a task", de: "hat eine Aufgabe aktualisiert", fr: "a mis à jour une tâche" },
  "yachtshift.import.failed": { nl: "kon YachtShift niet importeren", en: "failed to import from YachtShift", de: "konnte nicht von YachtShift importieren", fr: "n'a pas pu importer depuis YachtShift" },
  "yachtshift.import.empty_response": { nl: "kreeg een lege reactie van YachtShift bij het importeren", en: "got an empty response from YachtShift on import", de: "erhielt beim Import eine leere Antwort von YachtShift", fr: "a reçu une réponse vide de YachtShift lors de l'import" },
  "yachtshift.import.boat_synced": { nl: "heeft een boot gesynchroniseerd vanuit YachtShift", en: "synced a boat from YachtShift", de: "hat ein Boot von YachtShift synchronisiert", fr: "a synchronisé un bateau depuis YachtShift" },
  "yachtshift.import.conflict": { nl: "kreeg een synchronisatieconflict bij het importeren", en: "hit a sync conflict on import", de: "hat beim Import einen Synchronisierungskonflikt festgestellt", fr: "a rencontré un conflit de synchronisation lors de l'import" },
  "yachtshift.import.completed": { nl: "heeft een YachtShift-import afgerond", en: "completed a YachtShift import", de: "hat einen YachtShift-Import abgeschlossen", fr: "a terminé un import YachtShift" },
  "yachtshift.export.boat_synced": { nl: "heeft een boot geëxporteerd naar YachtShift", en: "exported a boat to YachtShift", de: "hat ein Boot zu YachtShift exportiert", fr: "a exporté un bateau vers YachtShift" },
  "yachtshift.export.failed": { nl: "kon niet exporteren naar YachtShift", en: "failed to export to YachtShift", de: "konnte nicht zu YachtShift exportieren", fr: "n'a pas pu exporter vers YachtShift" },
  "yachtshift.conflict.resolved": { nl: "heeft een synchronisatieconflict opgelost", en: "resolved a sync conflict", de: "hat einen Synchronisierungskonflikt gelöst", fr: "a résolu un conflit de synchronisation" },
} as const;

// Generic subject used when an event has no actor (system/automated jobs).
const SYSTEM_SUBJECT: Record<AppLocale, string> = {
  nl: "Systeem",
  en: "System",
  de: "System",
  fr: "Système",
};

const FALLBACK_PHRASE: Record<AppLocale, string> = {
  nl: "heeft een actie uitgevoerd:",
  en: "performed an action:",
  de: "hat eine Aktion durchgeführt:",
  fr: "a effectué une action :",
};

function humanizeActionKey(action: string): string {
  return action
    .replace(/[._]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Builds the card's main title, e.g. "Peter Seller heeft ingelogd" /
// "System performed an action: webhook.retry" for anything not in the map.
export function translateAuditTitle(
  action: string,
  actor: AuditActor,
  locale: AppLocale,
): string {
  const subject = actor?.name?.trim() || SYSTEM_SUBJECT[locale];
  const phrase = ACTION_PHRASES[action]?.[locale];
  if (phrase) return `${subject} ${phrase}`;
  return `${subject} ${FALLBACK_PHRASE[locale]} ${humanizeActionKey(action)}`;
}

// Translated event label independent of any actor — shown in the
// expanded/technical details section as a stand-in for the raw action key
// (e.g. "Event: Gebruiker ingelogd" instead of "Event: auth.login").
const AUDIT_EVENT_LABELS: Record<string, Record<AppLocale, string>> = {
  "auth.login": { nl: "Gebruiker ingelogd", en: "User logged in", de: "Benutzer angemeldet", fr: "Utilisateur connecté" },
  "auth.logout": { nl: "Gebruiker uitgelogd", en: "User logged out", de: "Benutzer abgemeldet", fr: "Utilisateur déconnecté" },
  "auth.register": { nl: "Account geregistreerd", en: "Account registered", de: "Konto registriert", fr: "Compte enregistré" },
  "me.profile.update": { nl: "Profiel bijgewerkt", en: "Profile updated", de: "Profil aktualisiert", fr: "Profil mis à jour" },
  "me.personal.update": { nl: "Persoonlijke gegevens bijgewerkt", en: "Personal details updated", de: "Persönliche Daten aktualisiert", fr: "Informations personnelles mises à jour" },
  "me.address.update": { nl: "Adres bijgewerkt", en: "Address updated", de: "Adresse aktualisiert", fr: "Adresse mise à jour" },
  "me.password.update": { nl: "Wachtwoord gewijzigd", en: "Password changed", de: "Passwort geändert", fr: "Mot de passe modifié" },
  "me.security.update": { nl: "Beveiligingsinstellingen bijgewerkt", en: "Security settings updated", de: "Sicherheitseinstellungen aktualisiert", fr: "Paramètres de sécurité mis à jour" },
  "admin.user.create": { nl: "Gebruiker aangemaakt", en: "User created", de: "Benutzer erstellt", fr: "Utilisateur créé" },
  "admin.user.update": { nl: "Gebruiker bijgewerkt", en: "User updated", de: "Benutzer aktualisiert", fr: "Utilisateur mis à jour" },
  "admin.user.disable": { nl: "Gebruiker gedeactiveerd", en: "User disabled", de: "Benutzer deaktiviert", fr: "Utilisateur désactivé" },
  "admin.user.locations": { nl: "Locatietoewijzing bijgewerkt", en: "Location assignment updated", de: "Standortzuweisung aktualisiert", fr: "Affectation de site mise à jour" },
  "impersonation.start": { nl: "Impersonatie gestart", en: "Impersonation started", de: "Identitätsübernahme gestartet", fr: "Usurpation d'identité démarrée" },
  "impersonation.stop": { nl: "Impersonatie beëindigd", en: "Impersonation stopped", de: "Identitätsübernahme beendet", fr: "Usurpation d'identité arrêtée" },
  "bid.created": { nl: "Bod geplaatst", en: "Bid placed", de: "Gebot abgegeben", fr: "Offre placée" },
  "bidder.registered": { nl: "Bieder geregistreerd", en: "Bidder registered", de: "Bieter registriert", fr: "Enchérisseur inscrit" },
  "bidder.verified": { nl: "Bieder geverifieerd", en: "Bidder verified", de: "Bieter verifiziert", fr: "Enchérisseur vérifié" },
  "contract.generate": { nl: "Contract gegenereerd", en: "Contract generated", de: "Vertrag erstellt", fr: "Contrat généré" },
  "lead.address.enriched": { nl: "Leadadres verrijkt", en: "Lead address enriched", de: "Lead-Adresse angereichert", fr: "Adresse du prospect enrichie" },
  "lead.assigned": { nl: "Lead toegewezen", en: "Lead assigned", de: "Lead zugewiesen", fr: "Prospect assigné" },
  "lead.converted": { nl: "Lead omgezet naar klant", en: "Lead converted to client", de: "Lead in Kunden umgewandelt", fr: "Prospect converti en client" },
  "lead.created": { nl: "Lead aangemaakt", en: "Lead created", de: "Lead erstellt", fr: "Prospect créé" },
  "lead.message.created": { nl: "Leadbericht toegevoegd", en: "Lead message added", de: "Lead-Nachricht hinzugefügt", fr: "Message de prospect ajouté" },
  "lead.status.changed": { nl: "Leadstatus gewijzigd", en: "Lead status changed", de: "Lead-Status geändert", fr: "Statut du prospect modifié" },
  "lead.updated": { nl: "Lead bijgewerkt", en: "Lead updated", de: "Lead aktualisiert", fr: "Prospect mis à jour" },
  "platform.created": { nl: "Platform aangemaakt", en: "Platform created", de: "Plattform erstellt", fr: "Plateforme créée" },
  "platform.updated": { nl: "Platform bijgewerkt", en: "Platform updated", de: "Plattform aktualisiert", fr: "Plateforme mise à jour" },
  "platform.deleted": { nl: "Platform verwijderd", en: "Platform deleted", de: "Plattform gelöscht", fr: "Plateforme supprimée" },
  "platform.logo.uploaded": { nl: "Platformlogo geüpload", en: "Platform logo uploaded", de: "Plattform-Logo hochgeladen", fr: "Logo de plateforme téléversé" },
  "platform.test_connection": { nl: "Verbindingstest uitgevoerd", en: "Connection test run", de: "Verbindungstest durchgeführt", fr: "Test de connexion effectué" },
  "platform.publication.synced": { nl: "Boot gesynchroniseerd met platform", en: "Boat synced to platform", de: "Boot mit Plattform synchronisiert", fr: "Bateau synchronisé avec la plateforme" },
  "platform.publication.failed": { nl: "Synchronisatie met platform mislukt", en: "Platform sync failed", de: "Synchronisation mit Plattform fehlgeschlagen", fr: "Échec de la synchronisation avec la plateforme" },
  "platform.export.feed_generated": { nl: "Testfeed gegenereerd", en: "Test feed generated", de: "Test-Feed generiert", fr: "Flux de test généré" },
  "platform.export.feed_failed": { nl: "Genereren van testfeed mislukt", en: "Test feed generation failed", de: "Generierung des Test-Feeds fehlgeschlagen", fr: "Échec de la génération du flux de test" },
  "platform.export.validation_failed": { nl: "Feed voldoet niet aan OpenMarine-validatie", en: "Feed fails OpenMarine validation", de: "Feed besteht OpenMarine-Validierung nicht", fr: "Le flux échoue à la validation OpenMarine" },
  "partner.created": { nl: "Partneraccount aangemaakt", en: "Partner account created", de: "Partnerkonto erstellt", fr: "Compte partenaire créé" },
  "signhost.cancel": { nl: "Ondertekeningsverzoek geannuleerd", en: "Signing request cancelled", de: "Signaturanfrage storniert", fr: "Demande de signature annulée" },
  "signhost.request": { nl: "Ondertekeningsverzoek verstuurd", en: "Signing request sent", de: "Signaturanfrage gesendet", fr: "Demande de signature envoyée" },
  "signhost.resend": { nl: "Ondertekeningsverzoek opnieuw verstuurd", en: "Signing request resent", de: "Signaturanfrage erneut gesendet", fr: "Demande de signature renvoyée" },
  "signhost.status.updated": { nl: "Ondertekeningsstatus bijgewerkt", en: "Signing status updated", de: "Signaturstatus aktualisiert", fr: "Statut de signature mis à jour" },
  "task.accept": { nl: "Taak geaccepteerd", en: "Task accepted", de: "Aufgabe angenommen", fr: "Tâche acceptée" },
  "task.attachment.add": { nl: "Bijlage toegevoegd", en: "Attachment added", de: "Anhang hinzugefügt", fr: "Pièce jointe ajoutée" },
  "task.attachment.delete": { nl: "Bijlage verwijderd", en: "Attachment removed", de: "Anhang entfernt", fr: "Pièce jointe supprimée" },
  "task.comment.add": { nl: "Taak becommentarieerd", en: "Task commented on", de: "Aufgabe kommentiert", fr: "Tâche commentée" },
  "task.create": { nl: "Taak aangemaakt", en: "Task created", de: "Aufgabe erstellt", fr: "Tâche créée" },
  "task.delete": { nl: "Taak verwijderd", en: "Task deleted", de: "Aufgabe gelöscht", fr: "Tâche supprimée" },
  "task.reject": { nl: "Taak afgewezen", en: "Task rejected", de: "Aufgabe abgelehnt", fr: "Tâche rejetée" },
  "task.remind": { nl: "Taakherinnering verstuurd", en: "Task reminder sent", de: "Aufgabenerinnerung gesendet", fr: "Rappel de tâche envoyé" },
  "task.reorder": { nl: "Taken herschikt", en: "Tasks reordered", de: "Aufgaben neu geordnet", fr: "Tâches réorganisées" },
  "task.reschedule": { nl: "Taak verzet", en: "Task rescheduled", de: "Aufgabe verschoben", fr: "Tâche reprogrammée" },
  "task.status.update": { nl: "Taakstatus bijgewerkt", en: "Task status updated", de: "Aufgabenstatus aktualisiert", fr: "Statut de tâche mis à jour" },
  "task.update": { nl: "Taak bijgewerkt", en: "Task updated", de: "Aufgabe aktualisiert", fr: "Tâche mise à jour" },
  "yachtshift.import.failed": { nl: "YachtShift-import mislukt", en: "YachtShift import failed", de: "YachtShift-Import fehlgeschlagen", fr: "Échec de l'import YachtShift" },
  "yachtshift.import.empty_response": { nl: "Lege reactie van YachtShift", en: "Empty response from YachtShift", de: "Leere Antwort von YachtShift", fr: "Réponse vide de YachtShift" },
  "yachtshift.import.boat_synced": { nl: "Boot gesynchroniseerd vanuit YachtShift", en: "Boat synced from YachtShift", de: "Boot von YachtShift synchronisiert", fr: "Bateau synchronisé depuis YachtShift" },
  "yachtshift.import.conflict": { nl: "Synchronisatieconflict bij import", en: "Sync conflict on import", de: "Synchronisierungskonflikt beim Import", fr: "Conflit de synchronisation à l'import" },
  "yachtshift.import.completed": { nl: "YachtShift-import voltooid", en: "YachtShift import completed", de: "YachtShift-Import abgeschlossen", fr: "Import YachtShift terminé" },
  "yachtshift.export.boat_synced": { nl: "Boot geëxporteerd naar YachtShift", en: "Boat exported to YachtShift", de: "Boot zu YachtShift exportiert", fr: "Bateau exporté vers YachtShift" },
  "yachtshift.export.failed": { nl: "Export naar YachtShift mislukt", en: "YachtShift export failed", de: "YachtShift-Export fehlgeschlagen", fr: "Échec de l'export YachtShift" },
  "yachtshift.conflict.resolved": { nl: "Synchronisatieconflict opgelost", en: "Sync conflict resolved", de: "Synchronisierungskonflikt gelöst", fr: "Conflit de synchronisation résolu" },
  updated: { nl: "Record bijgewerkt", en: "Record updated", de: "Datensatz aktualisiert", fr: "Enregistrement mis à jour" },
};

export function translateAuditEventLabel(action: string, locale: AppLocale): string {
  return AUDIT_EVENT_LABELS[action]?.[locale] ?? humanizeActionKey(action);
}

const ROLE_LABELS: Record<string, Record<AppLocale, string>> = {
  ADMIN: { nl: "Admin", en: "Admin", de: "Admin", fr: "Admin" },
  EMPLOYEE: { nl: "Medewerker", en: "Employee", de: "Mitarbeiter", fr: "Employé" },
  CLIENT: { nl: "Klant", en: "Client", de: "Kunde", fr: "Client" },
  SELLER: { nl: "Verkoper", en: "Seller", de: "Verkäufer", fr: "Vendeur" },
  BUYER: { nl: "Koper", en: "Buyer", de: "Käufer", fr: "Acheteur" },
  PARTNER: { nl: "Partner", en: "Partner", de: "Partner", fr: "Partenaire" },
};

export function translateActorRole(
  role: string | null | undefined,
  locale: AppLocale,
): string {
  if (!role) return "—";
  return ROLE_LABELS[role.toUpperCase()]?.[locale] ?? role;
}

const STATUS_LABELS: Record<AppLocale, { success: string; fail: string; unknown: string }> = {
  nl: { success: "Succes", fail: "Mislukt", unknown: "Onbekend" },
  en: { success: "Success", fail: "Failed", unknown: "Unknown" },
  de: { success: "Erfolg", fail: "Fehlgeschlagen", unknown: "Unbekannt" },
  fr: { success: "Succès", fail: "Échoué", unknown: "Inconnu" },
};

export function translateAuditStatus(
  result: string | null | undefined,
  locale: AppLocale,
): { label: string; tone: "success" | "fail" | "unknown" } {
  const normalized = String(result ?? "").toUpperCase();
  if (normalized === "SUCCESS" || normalized === "OK") {
    return { label: STATUS_LABELS[locale].success, tone: "success" };
  }
  if (normalized === "FAIL" || normalized === "FAILED" || normalized === "ERROR") {
    return { label: STATUS_LABELS[locale].fail, tone: "fail" };
  }
  return { label: STATUS_LABELS[locale].unknown, tone: "unknown" };
}

const ENTITY_LABELS: Record<string, Record<AppLocale, string>> = {
  User: { nl: "Gebruiker", en: "User", de: "Benutzer", fr: "Utilisateur" },
  Yacht: { nl: "Jacht", en: "Yacht", de: "Yacht", fr: "Yacht" },
  Lead: { nl: "Lead", en: "Lead", de: "Lead", fr: "Prospect" },
  Task: { nl: "Taak", en: "Task", de: "Aufgabe", fr: "Tâche" },
  Location: { nl: "Locatie", en: "Location", de: "Standort", fr: "Site" },
  Conversation: { nl: "Gesprek", en: "Conversation", de: "Gespräch", fr: "Conversation" },
  Contract: { nl: "Contract", en: "Contract", de: "Vertrag", fr: "Contrat" },
  SignRequest: { nl: "Ondertekeningsverzoek", en: "Signing request", de: "Signaturanfrage", fr: "Demande de signature" },
  Platform: { nl: "Platform", en: "Platform", de: "Plattform", fr: "Plateforme" },
  yachtshift_sync: { nl: "YachtShift-synchronisatie", en: "YachtShift sync", de: "YachtShift-Synchronisierung", fr: "Synchronisation YachtShift" },
};

// Strips the PHP namespace off entity_type/target_type (e.g.
// "App\Models\User" -> "User") and translates the remaining basename —
// this is the fix for the literal "App\Models\User #36" bug reported.
export function translateEntityType(
  entityType: string | null | undefined,
  locale: AppLocale,
): string {
  if (!entityType) return "—";
  const basename = entityType.split("\\").pop() || entityType;
  return ENTITY_LABELS[basename]?.[locale] ?? basename;
}

// Maps a snapshot column name to its already-translated label from the
// account page's own field dictionary where one exists (avoids duplicating
// those translations), falling back to a humanized version of the column
// name for anything account-page fields don't cover.
const CHANGED_FIELD_ACCOUNT_KEYS: Record<string, string> = {
  first_name: "firstName",
  last_name: "lastName",
  email: "emailAddress",
  phone: "phoneNumber",
  date_of_birth: "dateOfBirth",
  street: "street",
  house_number: "houseNumber",
  postal_code: "postalCode",
  city: "city",
  state: "state",
  country: "country",
  name: "fullName",
  locale: "locale",
};

export function translateChangedField(field: string, locale: AppLocale): string {
  const accountKey = CHANGED_FIELD_ACCOUNT_KEYS[field];
  if (accountKey) {
    const dictionary = getDictionary(locale) as unknown as {
      DashboardAccount?: { fields?: Record<string, string> };
    };
    const label = dictionary.DashboardAccount?.fields?.[accountKey];
    if (label) return label;
  }
  return field
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Diffs two audit snapshots down to the list of keys whose values actually
// changed — skips internal/noisy columns that aren't meaningful to an admin.
const IGNORED_DIFF_KEYS = new Set([
  "id", "created_at", "updated_at", "password", "remember_token",
  "email_verified_at", "otp_secret", "two_factor_confirmed_at",
]);

export function diffChangedFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): string[] {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  keys.forEach((key) => {
    if (IGNORED_DIFF_KEYS.has(key)) return;
    const beforeValue = JSON.stringify(before[key] ?? null);
    const afterValue = JSON.stringify(after[key] ?? null);
    if (beforeValue !== afterValue) changed.push(key);
  });
  return changed;
}
