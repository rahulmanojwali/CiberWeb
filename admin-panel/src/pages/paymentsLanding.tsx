import React from "react";
import { Button, Divider, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";

export const PaymentsLanding: React.FC = () => {
  const { t } = useTranslation();
  const sections = [
    { label: t("menu.paymentModels"), path: "/payment-models" },
    { label: t("menu.orgPaymentSettings"), path: "/org-payment-settings" },
    { label: t("menu.mandiPaymentSettings"), path: "/mandi-payment-settings" },
    { label: t("menu.commodityFeeSettings"), path: "/commodity-fees" },
    { label: t("menu.paymentModes"), path: "/payment-modes" },
    { label: t("menu.customFees"), path: "/custom-fees" },
    { label: t("menu.roleCustomFees"), path: "/role-custom-fees" },
  ];

  return (
    <PageContainer>
      <Typography variant="h4">{t("menu.paymentsAndSettlements")}</Typography>
      <Typography variant="body1" color="textSecondary">
        Central hub for viewing and tuning payment models, fees, and settlement rules.
      </Typography>
      <Divider sx={{ mt: 2, mb: 1 }} />
      <Stack spacing={1}>
        {sections.map((section) => (
          <Button
            key={section.path}
            variant="outlined"
            component={RouterLink}
            to={section.path}
            fullWidth
          >
            {section.label}
          </Button>
        ))}
      </Stack>
    </PageContainer>
  );
};
