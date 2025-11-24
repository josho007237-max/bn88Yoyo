import React from "react";

type Props = {
  title?: string;
  message?: string;
  className?: string;
  children: React.ReactNode;
  onConfirm: () => void | Promise<void>;
};
export default function ConfirmButton({ title="โปรดยืนยัน", message="ดำเนินการต่อ?", className="", children, onConfirm }: Props){
  async function handleClick(){
    const ok = window.confirm(`${title}\n\n${message}`);
    if(ok) await onConfirm();
  }
  return <button type="button" className={className} onClick={handleClick}>{children}</button>;
}
