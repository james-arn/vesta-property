import React from "react";
import { VscCollapseAll, VscExpandAll } from "react-icons/vsc";

interface ExpandCollapseControlProps {
  openGroups: { [key: string]: boolean };
  setOpenGroups: (openGroups: { [key: string]: boolean }) => void;
  propertyChecklistData: { group: string }[];
}

const ExpandCollapseControl: React.FC<ExpandCollapseControlProps> = ({
  openGroups,
  setOpenGroups,
  propertyChecklistData,
}) => {
  const allGroupsOpen = Object.values(openGroups).every(Boolean);

  const expandAll = () => {
    const allOpenGroups = propertyChecklistData.reduce((acc, item) => {
      acc[item.group] = true;
      return acc;
    }, {} as { [key: string]: boolean });
    setOpenGroups(allOpenGroups);
  };

  const collapseAll = () => {
    const allClosedGroups = propertyChecklistData.reduce((acc, item) => {
      acc[item.group] = false;
      return acc;
    }, {} as { [key: string]: boolean });
    setOpenGroups(allClosedGroups);
  };

  const handleClick = () => {
    if (allGroupsOpen) {
      collapseAll();
    } else {
      expandAll();
    }
  };

  return (
    <button onClick={handleClick} className="flex items-center w-full">
      {allGroupsOpen ? <VscCollapseAll size={20} /> : <VscExpandAll size={20} />}
      <span className="ml-2">{allGroupsOpen ? "Collapse All" : "Expand All"}</span>
    </button>
  );
};

export default ExpandCollapseControl;