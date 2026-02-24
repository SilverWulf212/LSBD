import { formatCents } from "@/lib/utils";

interface Fee {
  id: number;
  name: string;
  amount: number;
  description?: string | null;
}

interface FeeTableProps {
  caption: string;
  fees: Fee[];
}

export function FeeTable({ caption, fees }: FeeTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="text-left font-[family-name:var(--font-oswald)] text-xl font-bold text-[#005f8f] uppercase tracking-wide mb-4">
          {caption}
        </caption>
        <thead>
          <tr className="border-b-2 border-[#0077B6]">
            <th
              scope="col"
              className="text-left py-3 px-4 font-[family-name:var(--font-oswald)] text-sm font-semibold text-[#495057] uppercase tracking-wide"
            >
              Fee Description
            </th>
            <th
              scope="col"
              className="text-right py-3 px-4 font-[family-name:var(--font-oswald)] text-sm font-semibold text-[#495057] uppercase tracking-wide w-32"
            >
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {fees.map((fee, index) => (
            <tr
              key={fee.id}
              className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
            >
              <td className="py-3 px-4">
                <div className="text-sm font-medium text-[#1a1a1a]">
                  {fee.name}
                </div>
                {fee.description && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {fee.description}
                  </div>
                )}
              </td>
              <td className="py-3 px-4 text-right text-sm font-semibold text-[#005f8f] whitespace-nowrap">
                {formatCents(fee.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
