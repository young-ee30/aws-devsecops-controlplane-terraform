output "alb_dns_name" { value = module.alb.alb_dns_name }
output "cluster_name" { value = module.ecs.cluster_name }
output "ecr_repository_urls" { value = module.ecr.repository_urls }
output "artifact_bucket_name" { value = module.storage.artifact_bucket_name }
output "efs_id" { value = module.storage.efs_id }
output "bastion_public_ip" { value = try(module.bastion[0].public_ip, null) }
output "bastion_public_dns" { value = try(module.bastion[0].public_dns, null) }
output "bastion_security_group_id" { value = try(module.bastion[0].security_group_id, null) }
