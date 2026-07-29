import { categoryIconOptions, normalizeCategoryIcon } from "@/lib/category-icon-options";
import { CategoryIcon } from "@/components/category-icon";

export function CategoryIconPicker({
  name = "icon",
  defaultValue = "tag"
}: {
  name?: string;
  defaultValue?: string | null;
}) {
  const selected = normalizeCategoryIcon(defaultValue);

  return (
    <fieldset className="category-icon-picker">
      <legend>Icon</legend>
      <div className="category-icon-grid">
        {categoryIconOptions.map((option) => (
          <label title={option.label} key={option.key}>
            <input name={name} type="radio" value={option.key} defaultChecked={selected === option.key} />
            <span className="category-icon-choice">
              <CategoryIcon icon={option.key} size={17} />
              <span>{option.label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
