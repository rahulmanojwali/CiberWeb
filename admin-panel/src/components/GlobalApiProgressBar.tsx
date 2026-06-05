import { useApiLoading } from "../context/ApiLoadingContext";

export function GlobalApiProgressBar() {
  const { isLoading } = useApiLoading();

  if (!isLoading) return null;

  return (
    <div
      className="fixed top-[64px] left-0 right-0 z-[9999] h-1 bg-transparent"
      style={{
        position: "fixed",
        top: 64,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 4,
        background: "transparent",
      }}
    >
      <div
        className="h-full bg-[#55632C] animate-pulse"
        style={{ width: "100%", height: "100%", backgroundColor: "#55632C" }}
      />
    </div>
  );
}

export default GlobalApiProgressBar;
