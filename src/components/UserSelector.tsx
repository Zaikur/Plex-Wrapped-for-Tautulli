import { TautulliUser } from "@/types/tautulli";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";

interface UserSelectorProps {
  users: TautulliUser[];
  selectedUserId: number | null;
  onSelectUser: (userId: number | null) => void;
}

export const UserSelector = ({ users, selectedUserId, onSelectUser }: UserSelectorProps) => {
  return (
    <div className="flex items-center gap-3">
      <Users className="w-5 h-5 text-primary" />
      <Select
        value={selectedUserId?.toString() || "all"}
        onValueChange={(value) => onSelectUser(value === "all" ? null : parseInt(value))}
      >
        <SelectTrigger className="w-[200px] bg-card border-border">
          <SelectValue placeholder="Select user" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          <SelectItem value="all">All Users</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.user_id} value={user.user_id.toString()}>
              {user.friendly_name || user.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
