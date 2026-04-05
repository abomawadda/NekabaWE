import EmployeeCard from "./EmployeeCard";

export default function EmployeeList({ list, onEdit, onDelete, onOpen }) {
  if (list.length === 0)
    return (
      <p className="text-center text-slate-500 py-6">لا يوجد أعضاء مسجلين</p>
    );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {list.map((e) => (
        <EmployeeCard
          key={e.jobId}
          emp={e}
          onEdit={() => onEdit(e)}
          onDelete={() => onDelete(e.jobId)}
          onOpen={() => onOpen(e)}
        />
      ))}
    </div>
  );
}