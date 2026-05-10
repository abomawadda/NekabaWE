import clsx from "clsx";

export default function LogoBanner({ className = "" }) {
  return (
    <div
      className={clsx(
        "w-full flex justify-center items-center py-3 px-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 border-b-2 border-blue-400 dark:border-blue-600 shadow-sm",
        className
      )}
    >
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/0/0f/We_logo.svg"
        alt="We Logo"
        className="h-12 md:h-14 w-auto object-contain"
      />
    </div>
  );
}
