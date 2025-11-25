import Box, { BoxProps } from "@mui/material/Box";

type PageContainerProps = BoxProps;

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  sx,
  ...rest
}) => {
  return (
    <Box
      sx={{
        width: "100%",
        p: { xs: 1.5, md: 3 },
        display: "flex",
        flexDirection: "column",
        gap: 2,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
};
