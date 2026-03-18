variable "name_prefix" { type = string }
variable "private_subnet_ids_by_key" { type = map(string) }
variable "ecs_sg_id" { type = string }
variable "tags" {
  type    = map(string)
  default = {}
}
