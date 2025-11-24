import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
};

export default function LoadingButton({ children, onClick, ...rest }: Props) {
  const [loading, setLoading] = React.useState(false);
  return (
    <button
      {...rest}
      onClick={async (e) => {
        if (!onClick) return;
        if (loading) return;
        setLoading(true);
        try {
          await onClick(e);
        } finally {
          setLoading(false);
        }
      }}
      className={`rounded-xl bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 px-3 py-2 ${
        rest.className || ""
      }`}
      disabled={loading || rest.disabled}
    >
      {loading ? "กำลังทำงาน..." : children}
    </button>
  );
}
