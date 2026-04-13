const ButtonComponent = ({ onClick, text, id, ...className }: { onClick: () => void, text: string, id: string, className: string }) => {
  return (
    <button
      id={id}
      className={`bg-[#277fbc] text-white p-2 rounded-md ${className}`}
      onClick={onClick}
    >
      {text}
    </button>
  );
}

export default ButtonComponent