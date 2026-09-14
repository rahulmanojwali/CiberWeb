import React from "react";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "../../config/languages";
import { ParticipantDirectoryPage } from "../../components/participants/ParticipantDirectoryPage";
import { getFarmers, updateFarmerStatus } from "../../services/partyMastersApi";

export const Farmers: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  return <ParticipantDirectoryPage title="Farmer Directory" subtitle="View farmer memberships, linked Mandis and account status." partyLabel="Farmer" idField="farmer_id" resourcePrefix="farmers" language={language} getData={getFarmers} updateStatus={updateFarmerStatus} />;
};
