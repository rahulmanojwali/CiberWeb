import Box, { BoxProps } from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { FC, ReactNode } from "react";

type PageContainerProps = BoxProps & {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export const PageContainer: FC<PageContainerProps> = ({
  title,
  subtitle,
  actions,
  children,
  sx,
  ...rest
}) => {
  return (
    <Box
      className="cm-page"
      sx={{
        width: "100%",
        maxWidth: 1480,
        mx: "auto",
        px: { xs: 1.5, md: 3 },
        py: { xs: 2, md: 3 },
        display: "flex",
        flexDirection: "column",
        gap: 2,
        boxSizing: "border-box",
        ...sx,
      }}
      {...rest}
    >
      {(title || subtitle || actions) && (
        <Box
          className="cm-page-header"
          sx={{
            display: "flex",
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
            gap: 2,
            width: "100%",
          }}
        >
          <Box>
            {title && (
              <Typography className="cm-page-title" component="h1">
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography className="cm-page-subtitle" component="div">
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions && (
            <Box
              className="cm-page-actions"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              {actions}
            </Box>
          )}
        </Box>
      )}
      {children}
    </Box>
  );
};
