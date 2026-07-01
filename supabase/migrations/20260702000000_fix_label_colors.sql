-- The design-system rework renamed the label palette (labelColors.ts) to
-- rose/brass/sage/denim/plum/ochre, but this constraint was never updated to
-- match, so creating a label with any current palette color was rejected.

update labels set color = case color
  when 'green' then 'sage'
  when 'yellow' then 'ochre'
  when 'red' then 'rose'
  when 'purple' then 'plum'
  when 'blue' then 'denim'
  when 'sky' then 'denim'
  else color
end;

alter table labels drop constraint labels_color_check;
alter table labels add constraint labels_color_check
  check (color in ('rose', 'brass', 'sage', 'denim', 'plum', 'ochre'));
